/**
 * 퀀트 계산 유틸리티 (TypeScript)
 * ARDS-X, AMQS, ARDS — Python 포팅
 */

// ─── ARDS-X Regime Classifier ───
export function calculateRegime(
  price: number, ma20: number, ma60: number,
  rsi: number, volume: number, volumeSMA: number, vix: number
): { regime: number; label: string; signal: "BUY" | "SELL" | "HOLD" } {
  if (vix < 15 && price > ma20 && rsi > 70 && volume > volumeSMA * 2) {
    return { regime: 3, label: "급등", signal: "BUY" };
  }
  if (vix < 20 && price > ma20 && rsi > 50) {
    return { regime: 2, label: "상승", signal: "BUY" };
  }
  if (vix > 20 && vix < 30 && Math.abs(ma20 - ma60) / ma60 < 0.05 && rsi > 30 && rsi < 70) {
    return { regime: 1, label: "횡보", signal: "HOLD" };
  }
  if (vix > 30 && price < ma60 && rsi < 30) {
    return { regime: 0, label: "하락", signal: "SELL" };
  }
  // 기본값
  if (rsi > 50) return { regime: 2, label: "상승", signal: "BUY" };
  return { regime: 1, label: "횡보", signal: "HOLD" };
}

// ─── AMQS Momentum ───
export function calculateMomentum(prices: number[], period = 20): number {
  if (prices.length < period) return 0;
  const current = prices[prices.length - 1];
  const past = prices[prices.length - 1 - period];
  return ((current - past) / past) * 100;
}

export function momentumSignal(momentum: number): "BUY" | "SELL" | "HOLD" {
  if (momentum > 5) return "BUY";
  if (momentum < -5) return "SELL";
  return "HOLD";
}

// ─── ARDS Hedge Weight ───
export function calculateHedgeWeight(regime: number): { long: number; hedge: number; safe: number } {
  if (regime === 0) return { long: 65, hedge: 35, safe: 0 };
  if (regime === 1) return { long: 65, hedge: 15, safe: 20 };
  if (regime === 2) return { long: 80, hedge: 0, safe: 20 };
  return { long: 90, hedge: 0, safe: 10 };
}

// ─── 간단 RSI 계산 ───
export function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  let gain = 0, loss = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gain += diff;
    else loss -= diff;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ─── MA 계산 ───
export function calculateMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
