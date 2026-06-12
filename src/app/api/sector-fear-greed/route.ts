/**
 * 섹터별 공포·탐욕 지수 API (Yahoo Finance → Redis 10분 캐시)
 * ?force=true → 강제 갱신
 */
import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis-cache";
import { SECTORS, fearGreedScore, getStatus, getStatusColor, getStatusEmoji } from "@/lib/sector-fear-greed";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const CACHE_KEY = "sector-fear-greed";
const CACHE_TTL = 600; // 10분

interface YahooResponse {
    chart: {
        result: { timestamp: number[]; indicators: { quote: { open: number[]; close: number[]; volume: number[] }[] } }[];
    };
}

async function fetchYahoo(ticker: string): Promise<{ close: number[]; volume: number[] } | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=60d&interval=1d`;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) return null;
        const json: YahooResponse = await res.json();
        const result = json.chart.result?.[0];
        if (!result) return null;
        const quote = result.indicators.quote[0];
        return {
            close: quote.close.filter((v): v is number => v !== null),
            volume: quote.volume.filter((v): v is number => v !== null),
        };
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const force = req.nextUrl.searchParams.get("force") === "true";

    // 캐시 확인
    if (!force) {
        const cached = await getCache(CACHE_KEY);
        if (cached && !cached.stale) {
            return NextResponse.json({ ...cached.data, fromCache: true, cachedSecondsAgo: cached.age });
        }
    }

    try {
        // SPY 20일 수익률 (벤치마크)
        const spyData = await fetchYahoo("SPY");
        let spyRet20d = 0;
        if (spyData && spyData.close.length >= 21) {
            const n = spyData.close.length;
            spyRet20d = ((spyData.close[n - 1] / spyData.close[n - 21]) - 1) * 100;
        }

        // 각 섹터 ETF 데이터 수집
        const sectors: { name: string; ticker: string; score: number; status: string; color: string; emoji: string; signals: any }[] = [];
        const fetches = Object.entries(SECTORS).map(async ([name, ticker]) => ({ name, ticker, data: await fetchYahoo(ticker) }));

        const results = await Promise.all(fetches);

        for (const { name, ticker, data } of results) {
            if (!data || data.close.length < 30) {
                sectors.push({ name, ticker, score: -1, status: "데이터 부족", color: "#888", emoji: "❓", signals: {} });
                continue;
            }
            const result = fearGreedScore(data.close, data.volume, spyRet20d);
            if (!result) {
                sectors.push({ name, ticker, score: -1, status: "데이터 부족", color: "#888", emoji: "❓", signals: {} });
                continue;
            }
            sectors.push({
                name, ticker,
                score: result.final,
                status: getStatus(result.final),
                color: getStatusColor(result.final),
                emoji: getStatusEmoji(result.final),
                signals: { rsi: result.rsi, ma: result.ma, vol: result.vol, mom: result.mom, volSurge: result.volSurge },
            });
        }

        // SPY 기준 전체 시장 점수 (섹터 평균)
        const validScores = sectors.filter(s => s.score >= 0).map(s => s.score);
        const marketAvg = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 50;

        const payload = {
            generatedAt: new Date().toISOString(),
            fromCache: false,
            marketAvg: Math.round(marketAvg * 10) / 10,
            marketStatus: getStatus(marketAvg),
            sectors,
        };

        await setCache(CACHE_KEY, payload);
        return NextResponse.json(payload);
    } catch {
        // 폴백: 캐시 있으면 stale이라도 반환
        const stale = await getCache(CACHE_KEY);
        if (stale) return NextResponse.json({ ...stale.data, fromCache: true, cachedSecondsAgo: stale.age, stale: true });
        return NextResponse.json({ generatedAt: new Date().toISOString(), sectors: [], error: "failed" });
    }
}
