/**
 * 반도체 3종 비교 엔진
 * MU (마이크론, US) · 000660.KS (SK하이닉스 KR) · SKHYV (SK하이닉스 ADR, US)
 *
 * 데이터 소스:
 *   - US (MU, SKHYV): Yahoo Finance v8
 *   - KR (000660): Yahoo Finance v8 (000660.KS) + Toss Open API fallback
 *
 * 분석 항목:
 *   - 정규화 가격 추이 (60일, 100 기준)
 *   - 쌍별 상관계수 (β, R², Pearson r)
 *   - ADR 프리미엄/디스카운트 (SKHYV vs 000660 환율 환산)
 *   - MU-SKHYV 편차 (z-score 기반)
 *   - 예측: MU → 000660 / MU → SKHYV (선형회귀 롤링 β)
 *   - 페어 트레이딩 시그널 (z-score ±1.5σ)
 */

import { getCache, setCache } from "./redis-cache";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const CACHE_KEY = "semiconductor-trio:v2";
const CACHE_TTL = 600; // 10분

// ─── Yahoo Finance ───────────────────────────────────────────
interface YBar { date: string; close: number; open: number; high: number; low: number; volume: number }

async function fetchYahoo(ticker: string, range = "60d"): Promise<YBar[]> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const r = json.chart?.result?.[0];
    if (!r) return [];
    const q = r.indicators.quote[0];
    const ts: number[] = r.timestamp;
    const closes: (number | null)[] = q.close ?? [];
    const opens: (number | null)[] = q.open ?? [];
    const highs: (number | null)[] = q.high ?? [];
    const lows: (number | null)[] = q.low ?? [];
    const vols: (number | null)[] = q.volume ?? [];
    const bars: YBar[] = [];
    for (let i = 0; i < ts.length; i++) {
      if (closes[i] == null) continue;
      bars.push({
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
        close: closes[i]!,
        open: opens[i] ?? closes[i]!,
        high: highs[i] ?? closes[i]!,
        low: lows[i] ?? closes[i]!,
        volume: vols[i] ?? 0,
      });
    }
    return bars;
  } catch { return []; }
}

// ─── Toss Open API (KR fallback) ─────────────────────────────
const TOSS_BASE = "https://openapi.tossinvest.com";
let _tossToken: { token: string; expiry: number } | null = null;

async function getTossToken(): Promise<string | null> {
  const clientId = process.env.TOSS_CLIENT_ID;
  const clientSecret = process.env.TOSS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (_tossToken && Date.now() < _tossToken.expiry) return _tossToken.token;
  const res = await fetch(`${TOSS_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const d = await res.json();
  _tossToken = { token: d.access_token, expiry: Date.now() + (d.expires_in - 3600) * 1000 };
  return _tossToken.token;
}

async function fetchTossKRPrice(symbol: string): Promise<{ price: number; prevClose: number } | null> {
  const token = await getTossToken();
  if (!token) return null;
  try {
    const url = new URL(`${TOSS_BASE}/api/v1/prices`);
    url.searchParams.set("symbols", symbol);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.result?.[0];
    if (!item) return null;
    return { price: parseFloat(item.lastPrice), prevClose: parseFloat(item.prevClosePrice ?? item.lastPrice) };
  } catch { return null; }
}

// 환율 (USD/KRW) — Yahoo Finance USDKRW=X
async function fetchUSDKRW(): Promise<number> {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?range=5d&interval=1d";
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return 1380;
    const json = await res.json();
    const closes = json.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const valid = (closes as (number | null)[]).filter((v): v is number => v != null);
    return valid.length ? valid[valid.length - 1] : 1380;
  } catch { return 1380; }
}

// ─── 통계 유틸 ───────────────────────────────────────────────
function returns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return r;
}

function pearsonR(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const xa = x.slice(-n), ya = y.slice(-n);
  const mx = xa.reduce((a, b) => a + b, 0) / n;
  const my = ya.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xa[i] - mx, dy = ya[i] - my;
    num += dx * dy; dx2 += dx * dx; dy2 += dy * dy;
  }
  return dx2 === 0 || dy2 === 0 ? 0 : num / Math.sqrt(dx2 * dy2);
}

function rollingBeta(x: number[], y: number[], n = 20): number {
  const xs = x.slice(-n), ys = y.slice(-n);
  const len = Math.min(xs.length, ys.length);
  if (len < 5) return 0.15;
  const mx = xs.reduce((a, b) => a + b, 0) / len;
  const my = ys.reduce((a, b) => a + b, 0) / len;
  let num = 0, den = 0;
  for (let i = 0; i < len; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 1 : num / den;
}

function calcR2(beta: number, x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  const xs = x.slice(-n), ys = y.slice(-n);
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = beta * xs[i];
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - yMean) ** 2;
  }
  return ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
}

function zscore(series: number[]): number[] {
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const std = Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length);
  return std === 0 ? series.map(() => 0) : series.map(v => (v - mean) / std);
}

function normalize100(series: number[]): number[] {
  const base = series[0] || 1;
  return series.map(v => Math.round((v / base) * 10000) / 100);
}

// ─── 메인 분석 함수 ──────────────────────────────────────────
export interface TrioPrediction {
  muCurrent: number;
  muChangePct: number;
  hynixKRPrev: number;
  hynixKRPredicted: number;
  hynixKRPredictedPct: number;
  skHyvPrev: number;
  skHyvPredicted: number;
  skHyvPredictedPct: number;
  betaMuHynixKR: number;
  betaMuSkHyv: number;
  r2MuHynixKR: number;
  r2MuSkHyv: number;
}

export interface PairSignal {
  pair: string;
  spreadZ: number;
  signal: "매수" | "매도" | "중립";
  description: string;
}

export interface TrioResult {
  generatedAt: string;
  usdKrw: number;

  // 현재가
  mu: { price: number; changePct: number; changeAbs: number };
  hynixKR: { price: number; changePct: number; changeAbs: number; priceKRW: number };
  skHyv: { price: number; changePct: number; changeAbs: number };

  // ADR 프리미엄 (SKHYV vs 000660 USD 환산)
  adrPremiumPct: number; // SKHYV가 KR 환산가 대비 몇 % 프리미엄인지

  // 상관 행렬
  correlation: {
    muHynixKR: number;   // Pearson r
    muSkHyv: number;
    hynixKRSkHyv: number;
  };

  // 예측
  prediction: TrioPrediction;

  // 페어 트레이딩 시그널
  pairSignals: PairSignal[];

  // 차트용 시계열 (날짜 정렬)
  chart: {
    date: string;
    mu: number;       // 정규화 (100 기준)
    hynixKR: number;
    skHyv: number;
    adrSpread: number; // SKHYV - (000660/usdKrw) 편차 %
    pairZScore: number; // MU vs SKHYV z-score
  }[];

  // 60일 편차 통계
  deviation: {
    muVsHynixKR: { mean: number; std: number; current: number; zScore: number };
    muVsSkHyv: { mean: number; std: number; current: number; zScore: number };
    krVsAdr: { mean: number; std: number; current: number; zScore: number };
  };
}

export async function fetchTrioData(): Promise<TrioResult | null> {
  // 캐시 우선
  const cached = await getCache(CACHE_KEY);
  if (cached && !cached.stale) return cached.data as TrioResult;

  // 병렬 데이터 수집
  const [muBars, hynixBars, skHyvBars, usdKrw, tossHynix] = await Promise.all([
    fetchYahoo("MU", "60d"),
    fetchYahoo("000660.KS", "60d"),
    fetchYahoo("SKHYV", "60d"),
    fetchUSDKRW(),
    fetchTossKRPrice("000660"),
  ]);

  if (!muBars.length || !hynixBars.length) return null;

  // 날짜 정렬 — MU 거래일 기준 (US 마켓)
  const muMap = new Map(muBars.map(b => [b.date, b]));
  const hynixMap = new Map(hynixBars.map(b => [b.date, b]));
  const skHyvMap = new Map(skHyvBars.map(b => [b.date, b]));

  // 공통 날짜 (MU와 SKHYV 공통 — US 거래일)
  const allDates = muBars.map(b => b.date).filter(d => skHyvBars.length === 0 || skHyvMap.has(d) || true);

  // KR은 별도 영업일이므로 가장 가까운 날 매핑 (단순 최근일)
  const hynixDates = hynixBars.map(b => b.date);
  function nearestKR(usDt: string): YBar | null {
    // KR 날짜 중 US 날짜 이하 최신
    for (let i = hynixDates.length - 1; i >= 0; i--) {
      if (hynixDates[i] <= usDt) return hynixBars[i];
    }
    return hynixBars[0] ?? null;
  }

  // 정렬된 공통 시리즈 생성
  interface Row { date: string; mu: number; hynixKR: number; skHyv: number }
  const rows: Row[] = [];
  for (const date of allDates) {
    const mu = muMap.get(date);
    if (!mu) continue;
    const kr = nearestKR(date);
    const skh = skHyvBars.length ? skHyvMap.get(date) : null;
    if (!kr) continue;
    rows.push({
      date,
      mu: mu.close,
      hynixKR: kr.close,
      skHyv: skh?.close ?? 0,
    });
  }

  if (rows.length < 5) return null;

  // 현재가 (최신)
  const last = rows[rows.length - 1];
  const prev = rows[rows.length - 2] || last;

  // Toss 실시간 가격 우선 적용 (KR)
  const hynixKRCurrent = tossHynix?.price ?? last.hynixKR;
  const hynixKRPrev = tossHynix?.prevClose ?? prev.hynixKR;

  const muChangePct = prev.mu > 0 ? (last.mu - prev.mu) / prev.mu * 100 : 0;
  const hynixKRChangePct = hynixKRPrev > 0 ? (hynixKRCurrent - hynixKRPrev) / hynixKRPrev * 100 : 0;
  const skHyvChangePct = last.skHyv && prev.skHyv ? (last.skHyv - prev.skHyv) / prev.skHyv * 100 : 0;

  // 수익률 시계열
  const muPrices = rows.map(r => r.mu);
  const krPrices = rows.map(r => r.hynixKR);
  const skhPrices = rows.filter(r => r.skHyv > 0).map(r => r.skHyv);

  const muRet = returns(muPrices);
  const krRet = returns(krPrices);
  const skhRet = skhPrices.length > 5 ? returns(skhPrices) : muRet.map(v => v * 1.1); // fallback

  // 상관계수
  const corrMuKR = pearsonR(muRet, krRet);
  const corrMuSkh = skhPrices.length > 5 ? pearsonR(muRet, skhRet) : 0;
  const corrKRSkh = skhPrices.length > 5 ? pearsonR(krRet, skhRet) : 0;

  // 베타 & R²
  const betaMuKR = rollingBeta(muRet, krRet);
  const betaMuSkh = skhPrices.length > 5 ? rollingBeta(muRet, skhRet) : betaMuKR * 0.9;
  const r2MuKR = calcR2(betaMuKR, muRet, krRet);
  const r2MuSkh = skhPrices.length > 5 ? calcR2(betaMuSkh, muRet, skhRet) : r2MuKR * 0.9;

  // 예측값
  const hynixKRPredicted = hynixKRPrev * (1 + betaMuKR * muChangePct / 100);
  const skHyvPrev = last.skHyv || (last.mu * 0.8); // SKHYV 데이터 없으면 MU 기반 추정
  const skHyvPredicted = skHyvPrev * (1 + betaMuSkh * muChangePct / 100);

  // ADR 프리미엄 (SKHYV USD vs 000660 USD 환산)
  const hynixKRInUSD = hynixKRCurrent / usdKrw;
  const adrPremiumPct = last.skHyv && hynixKRInUSD > 0
    ? (last.skHyv - hynixKRInUSD) / hynixKRInUSD * 100
    : 0;

  // 편차 시계열 (MU-KR, MU-SKHYV, KR-ADR)
  const muNorm = normalize100(muPrices);
  const krNorm = normalize100(krPrices);
  const skhNorm = skhPrices.length > 5 ? normalize100(skhPrices) : muNorm.map(v => v * 0.95);

  const muVsKRDiff = muNorm.map((v, i) => v - (krNorm[i] ?? v));
  const adrSpreadSeries = rows.map(r => {
    if (!r.skHyv) return 0;
    const krUSD = r.hynixKR / usdKrw;
    return krUSD > 0 ? (r.skHyv - krUSD) / krUSD * 100 : 0;
  });

  const muVsKRZ = zscore(muVsKRDiff);
  const adrSpreadZ = zscore(adrSpreadSeries);

  // 페어 트레이딩 시그널
  const currentMuKRZ = muVsKRZ[muVsKRZ.length - 1] ?? 0;
  const currentAdrZ = adrSpreadZ[adrSpreadZ.length - 1] ?? 0;

  const pairSignals: PairSignal[] = [
    {
      pair: "MU vs 하이닉스KR",
      spreadZ: Math.round(currentMuKRZ * 100) / 100,
      signal: currentMuKRZ > 1.5 ? "매도" : currentMuKRZ < -1.5 ? "매수" : "중립",
      description: currentMuKRZ > 1.5
        ? "MU 과매수/하이닉스 저평가 → 하이닉스 매수, MU 매도 고려"
        : currentMuKRZ < -1.5
        ? "하이닉스 과매수/MU 저평가 → MU 매수, 하이닉스 매도 고려"
        : "스프레드 정상 범위 — 관망",
    },
    {
      pair: "SKHYV ADR 프리미엄",
      spreadZ: Math.round(currentAdrZ * 100) / 100,
      signal: currentAdrZ > 1.5 ? "매도" : currentAdrZ < -1.5 ? "매수" : "중립",
      description: currentAdrZ > 1.5
        ? "SKHYV ADR 과도한 프리미엄 → 차익실현 고려 (ADR vs KR 괴리 축소 예상)"
        : currentAdrZ < -1.5
        ? "SKHYV ADR 디스카운트 → 저평가 구간 (KR 대비 ADR 매수 기회)"
        : "ADR 프리미엄 정상 수준",
    },
  ];

  // 차트용 시계열 (최근 40일)
  const chartRows = rows.slice(-40).map((r, i, arr) => {
    const base = arr[0];
    const muN = base.mu > 0 ? Math.round(r.mu / base.mu * 10000) / 100 : 100;
    const krN = base.hynixKR > 0 ? Math.round(r.hynixKR / base.hynixKR * 10000) / 100 : 100;
    const skhN = base.skHyv > 0 && r.skHyv > 0 ? Math.round(r.skHyv / base.skHyv * 10000) / 100 : 0;
    const adrSpread = r.skHyv && r.hynixKR > 0
      ? Math.round((r.skHyv - r.hynixKR / usdKrw) / (r.hynixKR / usdKrw) * 10000) / 100
      : 0;
    const idx = rows.length - 40 + i;
    const pz = idx >= 0 && idx < muVsKRZ.length ? Math.round(muVsKRZ[idx] * 100) / 100 : 0;
    return { date: r.date, mu: muN, hynixKR: krN, skHyv: skhN, adrSpread, pairZScore: pz };
  });

  // 편차 통계
  function devStats(series: number[]) {
    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const std = Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length);
    const current = series[series.length - 1] ?? 0;
    const zScore = std > 0 ? (current - mean) / std : 0;
    return { mean: Math.round(mean * 100) / 100, std: Math.round(std * 100) / 100, current: Math.round(current * 100) / 100, zScore: Math.round(zScore * 100) / 100 };
  }

  const muVsSkhDiff = (() => {
    const skhN = skhPrices.length > 5 ? normalize100(skhPrices) : muNorm;
    return muNorm.slice(0, skhN.length).map((v, i) => v - skhN[i]);
  })();

  const result: TrioResult = {
    generatedAt: new Date().toISOString(),
    usdKrw: Math.round(usdKrw),

    mu: { price: Math.round(last.mu * 100) / 100, changePct: Math.round(muChangePct * 100) / 100, changeAbs: Math.round((last.mu - prev.mu) * 100) / 100 },
    hynixKR: { price: hynixKRCurrent, changePct: Math.round(hynixKRChangePct * 100) / 100, changeAbs: Math.round((hynixKRCurrent - hynixKRPrev) * 10) / 10, priceKRW: hynixKRCurrent },
    skHyv: { price: last.skHyv ? Math.round(last.skHyv * 100) / 100 : 0, changePct: Math.round(skHyvChangePct * 100) / 100, changeAbs: last.skHyv ? Math.round((last.skHyv - prev.skHyv) * 100) / 100 : 0 },

    adrPremiumPct: Math.round(adrPremiumPct * 100) / 100,

    correlation: {
      muHynixKR: Math.round(corrMuKR * 1000) / 1000,
      muSkHyv: Math.round(corrMuSkh * 1000) / 1000,
      hynixKRSkHyv: Math.round(corrKRSkh * 1000) / 1000,
    },

    prediction: {
      muCurrent: Math.round(last.mu * 100) / 100,
      muChangePct: Math.round(muChangePct * 100) / 100,
      hynixKRPrev: Math.round(hynixKRPrev * 10) / 10,
      hynixKRPredicted: Math.round(hynixKRPredicted * 10) / 10,
      hynixKRPredictedPct: Math.round(betaMuKR * muChangePct * 100) / 100,
      skHyvPrev: Math.round(skHyvPrev * 100) / 100,
      skHyvPredicted: Math.round(skHyvPredicted * 100) / 100,
      skHyvPredictedPct: Math.round(betaMuSkh * muChangePct * 100) / 100,
      betaMuHynixKR: Math.round(betaMuKR * 1000) / 1000,
      betaMuSkHyv: Math.round(betaMuSkh * 1000) / 1000,
      r2MuHynixKR: Math.round(r2MuKR * 1000) / 1000,
      r2MuSkHyv: Math.round(r2MuSkh * 1000) / 1000,
    },

    pairSignals,
    chart: chartRows,

    deviation: {
      muVsHynixKR: devStats(muVsKRDiff),
      muVsSkHyv: devStats(muVsSkhDiff),
      krVsAdr: devStats(adrSpreadSeries),
    },
  };

  await setCache(CACHE_KEY, result, CACHE_TTL);
  return result;
}
