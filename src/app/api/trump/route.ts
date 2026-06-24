/**
 * Trump Pick API
 * - Truth Social: RSS 차단 시 Google News "Trump Truth Social" 쿼리로 SNS 내용 수집
 * - Google News RSS 다중 쿼리 병렬 수집
 * - Claude Haiku로 의도 분석 + 영향 종목 BUY/SELL 평가
 * - 1시간 캐시 (Redis), ?refresh=1 강제 갱신
 */
import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis-cache";

const CACHE_KEY = "trump:analysis:v2";
const CACHE_TTL = 3600;

const WATCHLIST_SECTORS = `
[에너지/석유] XOM, CVX, OXY, DVN, MPC, PSX
[방산/항공] LMT, RTX, NOC, GD, BA, HII
[금융/은행] JPM, BAC, GS, MS, WFC, C
[철강/소재] X, NUE, STLD, CLF, AA
[제약/헬스] JNJ, MRK, PFE, UNH, HUM
[빅테크] AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA
[중국/신흥] BIDU, BABA, JD, NIO, PDD
[리테일] WMT, TGT, COST
[암호화자산] MSTR, COIN, RIOT, MARA
[트럼프미디어] TMTG, DJT
[반도체] NVDA, AMD, INTC, QCOM, TSM, AVGO, AMAT
`;

// Truth Social 대체 + 트럼프 뉴스 쿼리 — 인용/보도 중심
const NEWS_QUERIES = [
  // 일반 정책 뉴스
  "Trump tariff trade policy",
  "Trump executive order 2025",
  "Trump stock market economy",
  // Truth Social 인용 보도 (SNS 내용 수집 대체)
  "Trump Truth Social post says",
  "Trump posted Truth Social",
  "Trump tweet statement announcement",
  // 주요 정책 영역
  "Trump tariff China import",
  "Trump crypto bitcoin policy",
];

// Truth Social RSS 엔드포인트 (Vercel에서 대부분 차단됨 → 실패해도 OK)
const TRUTH_SOCIAL_RSS = [
  "https://truthsocial.com/@realDonaldTrump.rss",
  "https://rss.truthsocial.com/@realDonaldTrump",
  "https://api.truthsocial.com/api/v1/accounts/107780257626128497/statuses.rss",
];

async function tryFetch(url: string, timeout = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(timeout),
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return (text.includes("<item>") || text.includes("<entry>")) ? text : null;
  } catch { return null; }
}

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(xml: string, limit = 8) {
  const items: { title: string; text: string; date: string; link: string }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < limit) {
    const b = m[1];
    const title = stripHtml(decodeHtml(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(b)?.[1] ?? ""));
    const desc  = stripHtml(decodeHtml(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(b)?.[1] ?? ""));
    const date  = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(b)?.[1] ?? "").trim();
    const link  = (/<link>([\s\S]*?)<\/link>/.exec(b)?.[1] ?? /<link[^>]+href="([^"]+)"/.exec(b)?.[1] ?? "").trim();
    if (title || desc) items.push({ title, text: desc.slice(0, 350), date, link });
  }
  return items;
}

async function fetchTruthSocial() {
  for (const url of TRUTH_SOCIAL_RSS) {
    const xml = await tryFetch(url, 4000);
    if (xml) {
      const items = parseRssItems(xml, 6);
      if (items.length > 0) return { items, source: "Truth Social RSS" };
    }
  }
  return null;
}

async function fetchAllNews() {
  const all: { title: string; text: string; date: string; link: string; source: string }[] = [];
  await Promise.allSettled(
    NEWS_QUERIES.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const xml = await tryFetch(url, 6000);
      if (xml) {
        parseRssItems(xml, 5).forEach(i => all.push({ ...i, source: q }));
      }
    })
  );
  const seen = new Set<string>();
  return all
    .filter(i => {
      const k = i.title.slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    })
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 20);
}

// Truth Social 인용 뉴스에서 포스트 내용을 추출
function extractTruthQuotes(newsItems: { title: string; text: string; source: string }[]) {
  return newsItems
    .filter(n => n.source.includes("Truth Social") || n.title.toLowerCase().includes("truth social") || n.text.toLowerCase().includes("truth social"))
    .slice(0, 5)
    .map(n => ({ title: n.title, text: n.text, date: "", link: "" }));
}

// ─── DeepSeek 분석 (OpenAI 호환 API) ───
async function analyzeWithClaude(
  truthPosts: { title: string; text: string; date: string }[],
  newsItems: { title: string; text: string; date: string; source: string }[],
): Promise<{ result: any; error: null } | { result: null; error: string }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { result: null, error: "DEEPSEEK_API_KEY 미설정 — Vercel > Settings > Environment Variables에 추가 필요" };
  }

  const postsText = truthPosts.length > 0
    ? truthPosts.map((p, i) => `[Truth Social ${i+1}] ${p.title}\n${p.text}`).join("\n\n")
    : "(Truth Social RSS 차단 — 뉴스 인용 기반 분석)";

  const newsText = newsItems.slice(0, 15).map((n, i) =>
    `[뉴스 ${i+1}] ${n.title}\n${n.text}`
  ).join("\n\n");

  const prompt = `당신은 트럼프 행정부의 정책 동향을 분석하고 주식 시장 영향을 평가하는 전문 퀀트 애널리스트입니다.

아래의 트럼프 SNS/뉴스를 분석하여 반드시 유효한 JSON만 응답하세요 (설명 없이 JSON만).

=== 트루스소셜 포스트 ===
${postsText}

=== 관련 뉴스 ===
${newsText}

=== 관심 종목 섹터 ===
${WATCHLIST_SECTORS}

{
  "summary": "트럼프의 현재 주요 의도와 정책 방향 (한국어 2~3문장)",
  "mood": "강경 또는 중립 또는 완화 또는 불확실",
  "keyTopics": ["토픽1", "토픽2", "토픽3"],
  "marketImpact": "시장 전반 영향 (한국어 1~2문장)",
  "picks": [
    {
      "ticker": "종목코드",
      "name": "종목명",
      "action": "STRONG_BUY 또는 BUY 또는 WATCH 또는 SELL 또는 STRONG_SELL",
      "reason": "근거 (한국어 1문장)",
      "confidence": 75,
      "sector": "섹터",
      "priceTarget": "상승 또는 하락 또는 중립"
    }
  ],
  "riskFactors": ["리스크1", "리스크2"],
  "nextCatalyst": "다음 주목 이벤트 (한국어)"
}`;

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 1800,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return { result: null, error: `DeepSeek API ${res.status}: ${errBody.slice(0, 200)}` };
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { result: null, error: `JSON 파싱 실패. 응답: ${raw.slice(0, 200)}` };
    return { result: JSON.parse(match[0]), error: null };
  } catch (e: any) {
    return { result: null, error: e.message };
  }
}

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("refresh") === "1"
             || req.nextUrl.searchParams.get("force") === "true";

  if (!force) {
    const cached = await getCache(CACHE_KEY);
    if (cached && !cached.stale) {
      return NextResponse.json({ ...cached.data, fromCache: true, cachedSecondsAgo: cached.age });
    }
  }

  // 병렬 수집
  const [truthResult, newsItems] = await Promise.all([
    fetchTruthSocial(),
    fetchAllNews(),
  ]);

  const truthPosts = truthResult?.items ?? extractTruthQuotes(newsItems);
  const truthSource = truthResult?.source ?? "Google News (트루스소셜 인용 뉴스)";

  // Claude 분석
  const { result: analysis, error: analysisError } = await analyzeWithClaude(truthPosts, newsItems);

  const fallbackAnalysis = analysis ?? {
    summary: analysisError ?? "분석 불가",
    mood: "불확실",
    keyTopics: newsItems.slice(0, 3).map(n => n.title.slice(0, 25)),
    marketImpact: "뉴스 탭에서 원문 확인",
    picks: [],
    riskFactors: analysisError ? [analysisError] : [],
    nextCatalyst: "",
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    truthPosts,
    truthSource,
    newsItems: newsItems.slice(0, 15),
    analysis: fallbackAnalysis,
    analysisError: analysisError ?? null,
    fromCache: false,
  };

  if (!analysisError) {
    await setCache(CACHE_KEY, payload, CACHE_TTL);
  }

  return NextResponse.json(payload);
}
