import { NextResponse } from "next/server";

const SPACE_KEYWORDS = [
  "spacex","starship","falcon","starlink","rocket","launch","orbit",
  "satellite","space","mars","nasa","payload","booster","landing",
  "crew","dragon","raptor","contract","ipo","stock","invest","billion",
];

// Google News RSS — 항상 작동하는 안정적인 소스
const GOOGLE_NEWS_QUERIES = [
  "Elon Musk SpaceX",
  "SpaceX SPCX stock",
  "Starship launch",
];

async function tryFetch(url: string, timeout = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(timeout),
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("<item>") || text.includes("<entry>")) return text;
    return null;
  } catch {
    return null;
  }
}

async function fetchGoogleNews(): Promise<{ xml: string; source: string }> {
  for (const q of GOOGLE_NEWS_QUERIES) {
    const encoded = encodeURIComponent(q);
    const url = `https://news.google.com/rss/search?q=${encoded}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await tryFetch(url);
    if (xml) return { xml, source: `Google News (${q})` };
  }
  throw new Error("Google News fetch failed");
}

// nitter 인스턴스 시도 (성공하면 우선 사용)
const NITTER_INSTANCES = [
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
  "https://nitter.1d4.us",
  "https://nitter.kavin.rocks",
  "https://nitter.unixfox.eu",
  "https://n.sneed.network",
];

async function fetchElonRSS(): Promise<{ xml: string; source: string }> {
  // 1단계: nitter 병렬 시도 (3초 내 응답 있으면 사용)
  const results = await Promise.allSettled(
    NITTER_INSTANCES.map(base =>
      tryFetch(`${base}/elonmusk/rss`, 3000).then(xml => xml ? { xml, source: base } : null)
    )
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) return r.value;
  }

  // 2단계: Google News 폴백 (항상 작동)
  return fetchGoogleNews();
}

function parseRSSItems(xml: string): { title: string; link: string; pubDate: string; text: string }[] {
  const items: { title: string; link: string; pubDate: string; text: string }[] = [];

  const blocks = xml.split("<item>").slice(1);
  for (const block of blocks) {
    const title   = block.match(/<title[^>]*><!\[CDATA\[(.*?)\]\]>/s)?.[1]?.trim()
                 || block.match(/<title[^>]*>(.*?)<\/title>/s)?.[1]?.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim() || "";
    const link    = block.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || "";
    const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || "";
    const desc    = block.match(/<description><!\[CDATA\[(.*?)\]\]>/s)?.[1]
                 || block.match(/<description>(.*?)<\/description>/s)?.[1] || "";
    const text = (title + " " + desc).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (title.length > 5) items.push({ title, link, pubDate, text });
  }

  return items;
}

function isSpaceRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return SPACE_KEYWORDS.some(k => lower.includes(k));
}

async function analyzeTweets(tweets: any[]): Promise<any[]> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || !tweets.length) return tweets.map(t => ({ ...t, analysis: null }));

  const prompt = `다음은 SpaceX/일론 머스크 관련 최신 뉴스 목록입니다. 각 뉴스를 SpaceX 주식(SPCX) 투자 관점에서 분석해주세요.

뉴스 목록:
${tweets.map((t, i) => `[${i + 1}] ${t.text.slice(0, 300)}`).join("\n\n")}

각 뉴스에 대해 JSON 배열로 응답하세요 (순서 동일):
[
  {
    "sentiment": "bullish|bearish|neutral",
    "riskLevel": "high|medium|low",
    "impact": "SPCX 주가에 미칠 영향 한 문장 (한국어)",
    "investNote": "투자자 관점 액션 한 문장 (한국어)",
    "tags": ["관련 태그 2-3개"]
  }
]

JSON만 출력하세요. 마크다운 코드블록 없이.`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 1500,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "[]";
    const analyses = JSON.parse(raw.trim());
    return tweets.map((t, i) => ({ ...t, analysis: analyses[i] || null }));
  } catch {
    return tweets.map(t => ({ ...t, analysis: null }));
  }
}

let cache: { data: any; at: number } | null = null;
const CACHE_MS = 60 * 60 * 1000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    const { xml, source } = await fetchElonRSS();
    const all = parseRSSItems(xml);

    // nitter면 SpaceX 키워드 필터, Google News면 이미 관련 뉴스만 있음
    const isNitter = source.includes("nitter");
    const filtered = isNitter
      ? all.filter(t => isSpaceRelated(t.text)).slice(0, 8)
      : all.slice(0, 8);

    const withAnalysis = await analyzeTweets(filtered);

    const result = {
      tweets: withAnalysis,
      fetchedAt: new Date().toISOString(),
      source,
      isXPost: isNitter,
      cached: false,
    };

    cache = { data: result, at: Date.now() };
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({
      error: e.message,
      tweets: [],
      fetchedAt: new Date().toISOString(),
    }, { status: 200 });
  }
}
