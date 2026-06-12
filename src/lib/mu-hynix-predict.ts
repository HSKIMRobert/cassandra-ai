/**
 * 마이크론(MU) → SK하이닉스(000660) 상관도 기반 예측 엔진
 * MU 미국장 종가 → 하이닉스 한국장 시가 예측
 * Yahoo Finance 실시간 가격 + Redis 10분 캐시
 */
import { getCache, setCache } from "./redis-cache";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const CACHE_KEY_PREFIX = "mu-hynix";

// ─── Yahoo Finance fetch ───
interface YHData { close: number[]; timestamp: number[]; volume: number[] }

async function fetchYahoo(ticker: string, range = "60d"): Promise<YHData | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        if (!res.ok) return null;
        const json = await res.json();
        const r = json.chart?.result?.[0];
        if (!r) return null;
        return {
            close: r.indicators.quote[0].close.filter((v: unknown): v is number => v !== null),
            timestamp: r.timestamp || [],
            volume: r.indicators.quote[0].volume?.filter((v: unknown): v is number => v !== null) || [],
        };
    } catch { return null; }
}

// ─── 베타(상관도) 계산 ───
function calcBeta(xReturns: number[], yReturns: number[]): number {
    const n = Math.min(xReturns.length, yReturns.length);
    if (n < 5) return 1.2; // 기본값
    const x = xReturns.slice(-n), y = yReturns.slice(-n);
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
        num += (x[i] - xMean) * (y[i] - yMean);
        den += (x[i] - xMean) ** 2;
    }
    return den === 0 ? 1.2 : num / den;
}

// ─── 수익률 계산 ───
function returns(prices: number[]): number[] {
    const r: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return r;
}

// ─── 메인 예측 결과 ───
export interface MUHynixPrediction {
    generatedAt: string;
    muTicker: string;
    muCurrentPrice: number;
    muPrevClose: number;
    muChangePct: number;
    muSignal: "상승" | "하락" | "보합";
    hynixTicker: string;
    hynixPrevClose: number;
    hynixPredictedOpen: number;
    hynixPredictedChangePct: number;
    hynixSignal: "상승" | "하락" | "보합";
    beta: number;
    r2: number;
    dataPoints: number;
}

export async function predictHynix(): Promise<MUHynixPrediction | null> {
    // 캐시 확인
    const cached = await getCache(CACHE_KEY_PREFIX);
    if (cached && !cached.stale) return cached.data;

    const [muData, hynixData] = await Promise.all([
        fetchYahoo("MU"),
        fetchYahoo("000660.KS"),
    ]);

    if (!muData || !hynixData) return null;

    const muClose = muData.close;
    const hynixClose = hynixData.close;
    const minLen = Math.min(muClose.length, hynixClose.length);

    // MU 현재가 (최근 거래일)
    const muCurrent = muClose[muClose.length - 1];
    const muPrev = muClose[muClose.length - 2] || muCurrent;
    const muChangePct = ((muCurrent - muPrev) / muPrev) * 100;

    // 하이닉스 이전 종가
    const hynixPrev = hynixClose[hynixClose.length - 1];

    // 베타 계산 (20일 수익률 기준)
    const muRet = returns(muClose.slice(-21));
    const hynixRet = returns(hynixClose.slice(-21));
    const beta = calcBeta(muRet, hynixRet);

    // R² 계산
    const n = Math.min(muRet.length, hynixRet.length);
    let ssRes = 0, ssTot = 0;
    const yMean = hynixRet.slice(-n).reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) {
        const predicted = beta * muRet.slice(-n)[i];
        ssRes += (hynixRet.slice(-n)[i] - predicted) ** 2;
        ssTot += (hynixRet.slice(-n)[i] - yMean) ** 2;
    }
    const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

    // 하이닉스 예측 시가
    const predictedChangePct = beta * muChangePct;
    const predictedOpen = hynixPrev * (1 + predictedChangePct / 100);

    const result: MUHynixPrediction = {
        generatedAt: new Date().toISOString(),
        muTicker: "MU",
        muCurrentPrice: Math.round(muCurrent * 100) / 100,
        muPrevClose: Math.round(muPrev * 100) / 100,
        muChangePct: Math.round(muChangePct * 100) / 100,
        muSignal: muChangePct > 1 ? "상승" : muChangePct < -1 ? "하락" : "보합",
        hynixTicker: "000660",
        hynixPrevClose: Math.round(hynixPrev * 100) / 100,
        hynixPredictedOpen: Math.round(predictedOpen * 100) / 100,
        hynixPredictedChangePct: Math.round(predictedChangePct * 100) / 100,
        hynixSignal: predictedChangePct > 1 ? "상승" : predictedChangePct < -1 ? "하락" : "보합",
        beta: Math.round(beta * 1000) / 1000,
        r2: Math.round(r2 * 1000) / 1000,
        dataPoints: n,
    };

    // Redis 캐시 (10분)
    await setCache(CACHE_KEY_PREFIX, result);
    return result;
}
