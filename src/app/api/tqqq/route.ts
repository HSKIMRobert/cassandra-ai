import { NextResponse } from "next/server";

// 포트폴리오 상수 (1억 KRW 기준)
const TOTAL_KRW = 100_000_000;
const TQQQ_MAX_RATIO = 0.40;   // 최대 TQQQ 40%
const USD_RESERVE_RATIO = 0.30; // USD 현금 30%
const BOND_RESERVE_RATIO = 0.30; // 채권(TLT/IEF) 30%

// 딥바잉 트랜치 (QQQ 20일 고점 대비 하락 시)
export const TRANCHES = [
  { label: "1차", minDrop: 3,  maxDrop: 5,  alloc: 0.06, note: "초기 조정 — 소액 진입" },
  { label: "2차", minDrop: 5,  maxDrop: 8,  alloc: 0.08, note: "조정 확인 — 비중 확대" },
  { label: "3차", minDrop: 8,  maxDrop: 12, alloc: 0.10, note: "과매도 구간 — 적극 매수" },
  { label: "4차", minDrop: 12, maxDrop: 20, alloc: 0.10, note: "구조적 하락 — 분할매수" },
  { label: "5차", minDrop: 20, maxDrop: 99, alloc: 0.06, note: "극단 하락 — 최후 예비탄" },
];

const SYMBOLS = ["QQQ", "TQQQ", "TLT", "IEF", "^NDX"];

async function fetchOHLCV(symbol: string) {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=6mo&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Fetch failed: ${symbol}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data: ${symbol}`);

  const timestamps: number[] = result.timestamp || [];
  const q = result.indicators.quote[0];
  return timestamps.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open:   q.open?.[i]   ?? null,
    high:   q.high?.[i]   ?? null,
    low:    q.low?.[i]    ?? null,
    close:  q.close?.[i]  ?? null,
    volume: q.volume?.[i] ?? null,
  })).filter(b => b.close !== null);
}

function calcRSI(bars: any[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const closes = bars.map(b => b.close);
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function calcWilliamsR(bars: any[], period = 14): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  const hh = Math.max(...slice.map(b => b.high));
  const ll = Math.min(...slice.map(b => b.low));
  const close = bars[bars.length - 1].close;
  if (hh === ll) return -50;
  return ((hh - close) / (hh - ll)) * -100;
}

function calcSMA(bars: any[], period: number): number | null {
  if (bars.length < period) return null;
  return bars.slice(-period).reduce((s, b) => s + b.close, 0) / period;
}

// 20일 고점 대비 하락률
function calcDrawdownFrom20dHigh(bars: any[]): number {
  if (bars.length < 2) return 0;
  const slice = bars.slice(-20);
  const high20 = Math.max(...slice.map(b => b.high ?? b.close));
  const cur = bars[bars.length - 1].close;
  return ((cur - high20) / high20) * 100;
}

// 52주 고점 대비 하락률
function calc52wDrawdown(bars: any[]): number {
  if (bars.length < 2) return 0;
  const high52 = Math.max(...bars.map(b => b.high ?? b.close));
  const cur = bars[bars.length - 1].close;
  return ((cur - high52) / high52) * 100;
}

// 현재 활성화되어야 할 트랜치
function getActiveTranches(drop: number) {
  const absDrop = Math.abs(drop);
  return TRANCHES.filter(t => absDrop >= t.minDrop);
}

function getBuySignal(drop: number, rsi: number | null, wr: number | null): {
  signal: "STRONG_BUY" | "BUY" | "WATCH" | "HOLD" | "REDUCE";
  reason: string;
} {
  const absDrop = Math.abs(drop);
  const oversold = (rsi !== null && rsi < 35) || (wr !== null && wr <= -80);
  const veryOversold = (rsi !== null && rsi < 25) || (wr !== null && wr <= -90);

  if (absDrop >= 12 && veryOversold) return { signal: "STRONG_BUY", reason: "극단 과매도 + 구조적 하락 — 분할 적극 매수" };
  if (absDrop >= 8 && oversold)       return { signal: "STRONG_BUY", reason: "과매도 확인 + -8% 이상 하락 — 3차 이상 진입" };
  if (absDrop >= 5 && oversold)       return { signal: "BUY",        reason: "조정 + 과매도 신호 — 2~3차 진입 검토" };
  if (absDrop >= 3)                   return { signal: "WATCH",      reason: "조정 시작 — 1차 소액 진입 또는 관망" };
  if (absDrop < 1)                    return { signal: "HOLD",       reason: "고점 근처 — 신규 진입 자제, 보유 유지" };
  return { signal: "WATCH", reason: "소폭 하락 — 추세 확인 후 진입" };
}

// 메모리 캐시 (30분)
let cache: { data: any; at: number } | null = null;
const CACHE_MS = 30 * 60 * 1000;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";

  try {
    if (!force && cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json({ ...cache.data, cached: true });
    }

    const results = await Promise.allSettled(SYMBOLS.map(fetchOHLCV));

    const barsMap: Record<string, any[]> = {};
    SYMBOLS.forEach((sym, i) => {
      const r = results[i];
      if (r.status === "fulfilled") barsMap[sym] = r.value;
    });

    const makeQuote = (sym: string) => {
      const bars = barsMap[sym];
      if (!bars || bars.length < 2) return null;
      const last = bars[bars.length - 1];
      const prev = bars[bars.length - 2];
      return {
        symbol: sym,
        price:    last.close,
        change1d: ((last.close - prev.close) / prev.close) * 100,
        rsi14:    calcRSI(bars),
        williamsR: calcWilliamsR(bars),
        sma20:    calcSMA(bars, 20),
        sma50:    calcSMA(bars, 50),
        drawdown20d: calcDrawdownFrom20dHigh(bars),
        drawdown52w: calc52wDrawdown(bars),
        high52w: Math.max(...bars.map(b => b.high ?? b.close)),
        low52w:  Math.min(...bars.map(b => b.low  ?? b.close)),
        ohlcv:   bars.slice(-60),
      };
    };

    const qqq   = makeQuote("QQQ");
    const tqqq  = makeQuote("TQQQ");
    const tlt   = makeQuote("TLT");
    const ief   = makeQuote("IEF");
    const ndx   = makeQuote("^NDX");

    const drop = qqq?.drawdown20d ?? 0;
    const activeTranches = getActiveTranches(drop);
    const { signal, reason } = getBuySignal(drop, qqq?.rsi14 ?? null, qqq?.williamsR ?? null);

    // 포트폴리오 분배 계산
    const totalAllocated = activeTranches.reduce((s, t) => s + t.alloc, 0);
    const tqqqKrw  = Math.min(totalAllocated, TQQQ_MAX_RATIO) * TOTAL_KRW;
    const usdKrw   = USD_RESERVE_RATIO * TOTAL_KRW;
    const bondKrw  = BOND_RESERVE_RATIO * TOTAL_KRW;

    const data = {
      fetchedAt: new Date().toISOString(),
      quotes: { qqq, tqqq, tlt, ief, ndx },
      signal,
      reason,
      dropFrom20dHigh: drop,
      activeTranches,
      nextTranche: TRANCHES.find(t => Math.abs(drop) < t.minDrop) || null,
      portfolio: {
        totalKrw: TOTAL_KRW,
        tqqqKrw,
        usdKrw,
        bondKrw,
        tqqqRatio: tqqqKrw / TOTAL_KRW,
        usdRatio:  usdKrw  / TOTAL_KRW,
        bondRatio: bondKrw / TOTAL_KRW,
      },
      tranches: TRANCHES,
      cached: false,
    };

    cache = { data, at: Date.now() };
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
