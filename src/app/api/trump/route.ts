/**
 * Trump Pick API
 * - Truth Social RSS + 트럼프 관련 Google News RSS 수집
 * - Claude Haiku로 의도 분석 + 영향 종목 BUY/SELL 평가
 * - 1시간 캐시 (Redis), ?refresh=1 강제 갱신
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCache, setCache } from "@/lib/redis-cache";

const CACHE_KEY = "trump:analysis";
const CACHE_TTL = 3600; // 1시간

// ─── Trump 관련 뉴스 소스 ───
const TRUMP_NEWS_QUERIES = [
  "Trump tariff trade policy",
  "Trump executive order stock market",
  "Trump Truth Social announcement",
  "Donald Trump economy policy 2025",
];

const TRUTH_SOCIAL_RSS = [
  "https://truthsocial.com/@realDonaldTrump.rss",
  "https://rss.truthsocial.com/@realDonaldTrump",
];

// 영향 받을 수 있는 주요 종목 리스트
const WATCHLIST_SECTORS = `
[에너지/석유] XOM, CVX, OXY, DVN, MPC, PSX
[방산/항공] LMT, RTX, NOC, GD, BA, HII
[금융/은행] JPM, BAC, GS, MS, WFC, C, BRK.B
[철강/소재] X, NUE, STLD, CLF, AA
[제약/헬스] JNJ, MRK, PFE, UNH, HUM
[빅테크] AAPL, MSFT, GOOGL, AMZN, META, TSLA, NVDA
[중국/신흥] BIDU, BABA, JD, NIO, PDD
[리테일] WMT, TGT, COST, AMZN
[농업/식품] ADM, BG, MOS
[암호화자산] MSTR, COIN, RIOT, MARA
[미디어/SNS] DWAC, TMTG, DJT
[부동산] IYR, VNQ, AMT
[방어주/소비재] PG, KO, PEP, MCD
[반도체] NVDA, AMD, INTC, QCOM, TSM, AVGO, AMAT
`;

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
    return text.includes("<item>") || text.includes("<entry>") ? text : null;
  } catch { return null; }
}

function decodeHtml(str: string) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(str: string) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(xml: string, limit = 8) {
  const items: { title: string; text: string; date: string; link: string }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null && items.length < limit) {
    const block = m[1];
    const title = stripHtml(decodeHtml((/<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(block)?.[1] || /<title[^>]*>([\s\S]*?)<\/title>/.exec(block)?.[1] || "")));
    const desc  = stripHtml(decodeHtml((/<description[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/description>/.exec(block)?.[1] || /<description[^>]*>([\s\S]*?)<\/description>/.exec(block)?.[1] || "")));
    const date  = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1] || "").trim();
    const link  = (/<link>([\s\S]*?)<\/link>/.exec(block)?.[1] || /<link[^>]+href="([^"]+)"/.exec(block)?.[1] || "").trim();
    if (title || desc) items.push({ title, text: desc.slice(0, 300), date, link });
  }
  return items;
}

// ─── Truth Social RSS 시도 ───
async function fetchTruthSocial() {
  for (const url of TRUTH_SOCIAL_RSS) {
    const xml = await tryFetch(url, 5000);
    if (xml) {
      const items = parseRssItems(xml, 6);
      if (items.length > 0) return { items, source: "Truth Social" };
    }
  }
  return null;
}

// ─── Google News RSS ───
async function fetchTrumpNews() {
  const all: { title: string; text: string; date: string; link: string; source: string }[] = [];
  await Promise.allSettled(
    TRUMP_NEWS_QUERIES.map(async (q) => {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const xml = await tryFetch(url, 6000);
      if (xml) {
        const items = parseRssItems(xml, 4);
        items.forEach(i => all.push({ ...i, source: `Google News: ${q}` }));
      }
    })
  );
  // 날짜 기준 정렬 (최신순) 후 중복 제거
  const seen = new Set<string>();
  return all
    .filter(i => { const k = i.title.slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 20);
}

// ─── Claude Haiku 분석 ───
async function analyzeWithClaude(
  truthPosts: { title: string; text: string; date: string }[],
  newsItems: { title: string; text: string; date: string; source: string }[],
): Promise<any> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const postsText = truthPosts.length > 0
    ? truthPosts.map((p, i) => `[Truth Social ${i+1}] ${p.title}\n${p.text}`).join("\n\n")
    : "(Truth Social 데이터 없음 — 뉴스 기반 분석)";

  const newsText = newsItems.slice(0, 12).map((n, i) =>
    `[뉴스 ${i+1}] ${n.title}\n${n.text}`
  ).join("\n\n");

  const prompt = `당신은 트럼프 행정부의 정책 동향을 분석하고 주식 시장 영향을 평가하는 전문 퀀트 애널리스트입니다.

아래의 트럼프 트루스소셜 포스트와 관련 뉴스를 분석하여 JSON으로 응답하세요.

=== 트루스소셜 포스트 ===
${postsText}

=== 관련 뉴스 ===
${newsText}

=== 관심 종목 섹터 ===
${WATCHLIST_SECTORS}

응답 형식 (반드시 유효한 JSON만):
{
  "summary": "트럼프의 현재 주요 의도와 정책 방향을 한국어로 2~3문장 요약",
  "mood": "강경|중립|완화|불확실" (트럼프의 전반적 태도),
  "keyTopics": ["핵심 토픽 1", "핵심 토픽 2", "핵심 토픽 3"],
  "marketImpact": "시장 전반 영향을 한국어로 1~2문장",
  "picks": [
    {
      "ticker": "종목코드",
      "name": "종목명",
      "action": "STRONG_BUY|BUY|WATCH|SELL|STRONG_SELL",
      "reason": "한국어로 근거 1문장",
      "confidence": 0~100,
      "sector": "섹터명",
      "priceTarget": "단기(1개월) 방향: 상승/하락/중립"
    }
  ],
  "riskFactors": ["리스크 요인 1", "리스크 요인 2"],
  "nextCatalyst": "다음 주목할 이벤트/일정 (한국어)"
}

picks는 가장 영향이 클 것으로 예상되는 5~8개 종목만 포함하세요.
confidence는 분석 신뢰도(데이터 풍부도, 논리적 일관성 기준)입니다.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (response.content[0] as any).text ?? "";
  // JSON 추출
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("LLM JSON parse failed");
  return JSON.parse(jsonMatch[0]);
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

  try {
    // 병렬 수집
    const [truthResult, newsItems] = await Promise.all([
      fetchTruthSocial(),
      fetchTrumpNews(),
    ]);

    const truthPosts = truthResult?.items ?? [];

    // Claude 분석
    let analysis: any = null;
    let analysisError: string | null = null;
    if (!process.env.ANTHROPIC_API_KEY) {
      analysisError = "ANTHROPIC_API_KEY 환경변수 미설정 — Vercel 대시보드에서 추가 필요";
      analysis = {
        summary: analysisError,
        mood: "불확실",
        keyTopics: [],
        marketImpact: "API 키 설정 후 재시도",
        picks: [],
        riskFactors: ["Vercel → Settings → Environment Variables → ANTHROPIC_API_KEY 추가"],
        nextCatalyst: "",
      };
    } else {
      try {
        analysis = await analyzeWithClaude(truthPosts, newsItems);
      } catch (e: any) {
        analysisError = e.message;
        console.error("Claude analysis failed:", e.message);
        analysis = {
          summary: `Claude 분석 오류: ${e.message}`,
          mood: "불확실",
          keyTopics: newsItems.slice(0, 3).map(n => n.title.slice(0, 30)),
          marketImpact: "분석 재시도 중",
          picks: [],
          riskFactors: [`오류: ${e.message}`],
          nextCatalyst: "",
        };
      }
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      truthPosts,
      truthSource: truthResult?.source ?? null,
      newsItems: newsItems.slice(0, 15),
      analysis,
      analysisError,
      fromCache: false,
    };

    await setCache(CACHE_KEY, payload, CACHE_TTL);
    return NextResponse.json(payload);

  } catch (e: any) {
    const stale = await getCache(CACHE_KEY);
    if (stale) return NextResponse.json({ ...stale.data, fromCache: true, stale: true, error: e.message });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
