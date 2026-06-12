/**
 * 섹터별 공포·탐욕 지수 계산 유틸리티 (Python → TypeScript 포팅)
 * 10개 US 섹터 ETF × 5개 시그널 가중 평균 → 0~100 점수
 */

// 섹터 ETF 매핑
export const SECTORS: Record<string, string> = {
    "Technology": "XLK",
    "Financials": "XLF",
    "Healthcare": "XLV",
    "Consumer Disc": "XLY",
    "Consumer Staples": "XLP",
    "Industrials": "XLI",
    "Materials": "XLB",
    "Energy": "XLE",
    "Utilities": "XLU",
    "Real Estate": "XLRE",
};

export interface SectorScore {
    name: string;
    ticker: string;
    score: number;
    status: string;
    signals: { rsi: number; ma: number; vol: number; mom: number; volSurge: number };
}

const WEIGHTS = [0.25, 0.20, 0.20, 0.20, 0.15];

function clip(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function std(arr: number[]): number {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
    return Math.sqrt(variance);
}

export function fearGreedScore(
    close: number[],
    volume: number[],
    spyReturns20d: number
): { rsi: number; ma: number; vol: number; mom: number; volSurge: number; final: number } | null {
    const n = close.length;
    if (n < 30) return null;

    // ─── 1. RSI(14) ───
    const delta: number[] = [];
    for (let i = 1; i < n; i++) delta.push(close[i] - close[i - 1]);
    const gain: number[] = [], loss: number[] = [];
    for (const d of delta) { gain.push(d > 0 ? d : 0); loss.push(d < 0 ? -d : 0); }

    const avgGain = gain.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const avgLoss = loss.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - 100 / (1 + rs);
    const rsiScore = clip(((rsi - 30) / (70 - 30)) * 100, 0, 100);

    // ─── 2. Price vs MA20 ───
    const ma20 = close.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const price = close[n - 1];
    const pctMa = ((price / ma20) - 1) * 100;
    const maScore = clip(((pctMa + 5) / 10) * 100, 0, 100);

    // ─── 3. Volatility ratio (historical vol 20d / 60d) ───
    const returns: number[] = [];
    for (let i = 1; i < n; i++) returns.push((close[i] - close[i - 1]) / close[i - 1]);
    const sq252 = Math.sqrt(252);
    const hv20 = std(returns.slice(-20)) * sq252;
    const hv60 = returns.length >= 60 ? std(returns.slice(-60)) * sq252 : hv20;
    const volRatio = hv60 === 0 ? 1 : hv20 / hv60;
    const volScore = clip(((1.2 - volRatio) / (1.2 - 0.8)) * 100, 0, 100);

    // ─── 4. Sector momentum vs SPY ───
    const sectorRet20d = ((close[n - 1] / close[n - 21]) - 1) * 100;
    const relMom = sectorRet20d - spyReturns20d;
    const momScore = clip(((relMom + 10) / 20) * 100, 0, 100);

    // ─── 5. Volume surge ───
    const avgVol = volume.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volSurge = avgVol === 0 ? 1 : volume[n - 1] / avgVol;
    const volSurgeScore = clip(((volSurge - 0.7) / (1.5 - 0.7)) * 100, 0, 100);

    // 가중 평균
    const final = (
        rsiScore * WEIGHTS[0] +
        maScore * WEIGHTS[1] +
        volScore * WEIGHTS[2] +
        momScore * WEIGHTS[3] +
        volSurgeScore * WEIGHTS[4]
    );

    return {
        rsi: Math.round(rsiScore * 10) / 10,
        ma: Math.round(maScore * 10) / 10,
        vol: Math.round(volScore * 10) / 10,
        mom: Math.round(momScore * 10) / 10,
        volSurge: Math.round(volSurgeScore * 10) / 10,
        final: Math.round(final * 10) / 10,
    };
}

export function getStatus(score: number): string {
    if (score < 40) return "극단적 공포";
    if (score < 50) return "공포";
    if (score < 60) return "중립";
    if (score < 80) return "탐욕";
    return "극단적 탐욕";
}

export function getStatusColor(score: number): string {
    if (score < 40) return "#ef4444";
    if (score < 50) return "#f59e0b";
    if (score < 60) return "#888";
    if (score < 80) return "#22c55e";
    return "#a855f7";
}

export function getStatusEmoji(score: number): string {
    if (score < 40) return "🔥";
    if (score < 50) return "😨";
    if (score < 60) return "😐";
    if (score < 80) return "😈";
    return "🤑";
}
