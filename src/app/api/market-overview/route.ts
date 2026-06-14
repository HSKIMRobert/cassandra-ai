/**
 * 시장 오버뷰 API — 인기 ETF + 섹터 + 지수
 * Yahoo Finance + Redis 10분 캐시
 */
import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis-cache";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const CACHE_KEY = "market-overview";
const CACHE_TTL = 600;

// 인기 ETF
const POPULAR_ETFS = ["QQQ","TQQQ","SOXL","SCHD","JEPI","JEPQ","SMH","SOXX","NVDL","TSLL"];
const ETF_NAMES: Record<string,string> = { QQQ:"나스닥100",TQQQ:"나스닥3배",SOXL:"반도체3배",SCHD:"배당귀족",JEPI:"커버드콜",JEPQ:"나스닥커버드콜",SMH:"반도체",SOXX:"반도체2",NVDL:"엔비디아2배",TSLL:"테슬라2배" };

// 섹터 ETF
const SECTORS: Record<string,string> = { XLK:"기술",XLF:"금융",XLV:"헬스케어",XLE:"에너지",XLI:"산업재",XLY:"경기소비재",XLP:"필수소비재",XLU:"유틸리티",XLB:"소재",XLRE:"리츠",XLC:"커뮤니케이션" };

// 주요 지수
const INDICES = { SPY:"S&P 500",QQQ:"나스닥100",DIA:"다우",IWM:"러셀2000" };

async function fetchQuote(ticker: string) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) return null;
        const json = await res.json();
        const meta = json.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const price = meta.regularMarketPrice || 0;
        const prev = meta.previousClose || meta.chartPreviousClose || price;
        return { price, changePct: prev ? ((price - prev) / prev) * 100 : 0 };
    } catch { return null; }
}

export async function GET(req: NextRequest) {
    const force = req.nextUrl.searchParams.get("force") === "true";
    if (!force) {
        const cached = await getCache(CACHE_KEY);
        if (cached && !cached.stale) return NextResponse.json({ ...cached.data, fromCache: true });
    }

    try {
        const allTickers = [...POPULAR_ETFS, ...Object.keys(SECTORS), ...Object.keys(INDICES)];
        const unique = [...new Set(allTickers)];

        const results: Record<string, any> = {};
        // 배치로 가져오기 (병렬 5개씩)
        for (let i = 0; i < unique.length; i += 5) {
            const batch = unique.slice(i, i + 5);
            const quotes = await Promise.all(batch.map(t => fetchQuote(t)));
            batch.forEach((t, j) => { if (quotes[j]) results[t] = quotes[j]; });
        }

        const etfs = POPULAR_ETFS.filter(t => results[t]).map(t => ({
            ticker: t, name: ETF_NAMES[t] || t,
            price: Math.round(results[t].price * 100) / 100,
            changePct: Math.round(results[t].changePct * 100) / 100,
        }));

        const sectors = Object.entries(SECTORS).filter(([t]) => results[t]).map(([t, name]) => ({
            ticker: t, name,
            changePct: Math.round(results[t].changePct * 100) / 100,
        }));

        const indices = Object.entries(INDICES).filter(([t]) => results[t]).map(([t, name]) => ({
            ticker: t, name,
            price: Math.round(results[t].price * 100) / 100,
            changePct: Math.round(results[t].changePct * 100) / 100,
        }));

        // VIX
        const vix = await fetchQuote("^VIX");

        const payload = { etfs, sectors, indices, vix: vix ? Math.round(vix.price * 10) / 10 : null, generatedAt: new Date().toISOString() };
        await setCache(CACHE_KEY, payload);
        return NextResponse.json(payload);
    } catch {
        const stale = await getCache(CACHE_KEY);
        if (stale) return NextResponse.json({ ...stale.data, fromCache: true, stale: true });
        return NextResponse.json({ etfs:[], sectors:[], indices:[], vix:null });
    }
}
