/**
 * 네이버 증권 → 퀀트 대시보드 데이터 API (Redis 10분 캐시)
 * 실시간 원칙: 호출 시 Naver Finance fetch
 * 캐시: Upstash Redis (TTL 600초) / 인메모리 폴백
 * 새로고침: ?force=true → 캐시 무시하고 fresh fetch
 */
import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis-cache";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15";
const Q_CACHE_KEY = "quant:data";
const Q_CACHE_TTL = 600; // 10분

interface StockData {
    name: string;
    code: string;
    price: string;
    change: string;
    changePercent: number;
    volume?: number;
}

async function fetchNaverData() {
    const nasdaqCodes = [
        { code: "NVDA", name: "엔비디아", type: "us" },
        { code: "AAPL", name: "애플", type: "us" },
        { code: "MSFT", name: "마이크로소프트", type: "us" },
        { code: "TSLA", name: "테슬라", type: "us" },
        { code: "META", name: "메타", type: "us" },
        { code: "AMZN", name: "아마존", type: "us" },
    ];

    // KOSDAQ 시장 심리 (Naver)
    const marketRes = await fetch(
        "https://m.stock.naver.com/api/stocks/marketValue/KOSDAQ?page=1&pageSize=100&sortType=FLUCTUATION_RATE",
        { headers: { "User-Agent": UA } }
    ).catch(() => null);

    let fearGauge = 50, neutralGauge = 30, greedGauge = 20;
    if (marketRes) {
        const marketData = await marketRes.json();
        const stocks = marketData.stocks || [];
        let upCount = 0, downCount = 0;
        for (const s of stocks.slice(0, 100)) {
            if (s.compareToPreviousPrice?.code === "2") upCount++;
            else if (s.compareToPreviousPrice?.code === "5") downCount++;
        }
        const total = upCount + downCount || 1;
        fearGauge = Math.round((downCount / total) * 100);
        greedGauge = Math.round((upCount / total) * 100);
        neutralGauge = 100 - fearGauge - greedGauge;
    }

    // NASDAQ 개별 종목
    const stocks: StockData[] = [];
    for (const item of nasdaqCodes) {
        try {
            const res = await fetch(
                `https://api.stock.naver.com/stock/${item.code}/basic`,
                { headers: { "User-Agent": UA, "Referer": "https://m.stock.naver.com/" } }
            );
            if (!res.ok) continue;
            const data = await res.json();
            stocks.push({
                name: item.name, code: item.code,
                price: data.closePrice || "-",
                change: data.compareToPreviousClosePrice || "0",
                changePercent: data.fluctuationsRatio || 0,
            });
        } catch {}
    }

    return { marketGauge: { fear: fearGauge, neutral: neutralGauge, greed: greedGauge }, stocks };
}

export async function GET(req: NextRequest) {
    const force = req.nextUrl.searchParams.get("force") === "true";

    // 캐시 확인 (force=false 일 때만)
    if (!force) {
        const cached = await getCache(Q_CACHE_KEY);
        if (cached && !cached.stale) {
            return NextResponse.json({
                ...cached.data,
                fromCache: true,
                cachedSecondsAgo: cached.age,
            });
        }
    }

    // Fresh fetch
    try {
        const fresh = await fetchNaverData();
        const payload = {
            generatedAt: new Date().toISOString(),
            fromCache: false,
            ...fresh,
            totalAnalyzed: 100,
        };
        await setCache(Q_CACHE_KEY, payload, 600);
        return NextResponse.json(payload);
    } catch {
        // 폴백: 캐시 있으면 stale이라도 반환
        const stale = await getCache(Q_CACHE_KEY);
        if (stale) {
            return NextResponse.json({
                ...stale.data,
                fromCache: true,
                cachedSecondsAgo: stale.age,
                stale: true,
            });
        }
        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            marketGauge: { fear: 35, neutral: 40, greed: 25 },
            stocks: [],
            fromCache: false,
            cached: false,
        });
    }
}
