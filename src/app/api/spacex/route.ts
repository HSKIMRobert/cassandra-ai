import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STOCKS = [
  { symbol: "RKLB",  name: "Rocket Lab",           group: "pure_space" },
  { symbol: "ASTS",  name: "AST SpaceMobile",       group: "pure_space" },
  { symbol: "LUNR",  name: "Intuitive Machines",    group: "pure_space" },
  { symbol: "SPCE",  name: "Virgin Galactic",       group: "pure_space" },
  { symbol: "RDW",   name: "Redwire",               group: "pure_space" },
  { symbol: "ASTR",  name: "Astra Space",           group: "pure_space" },
  { symbol: "SPCX",  name: "SpaceX",                group: "pure_space" },
  { symbol: "ARKX",  name: "ARK Space ETF",         group: "etf"        },
  { symbol: "LMT",   name: "Lockheed Martin",       group: "defense"    },
  { symbol: "NOC",   name: "Northrop Grumman",      group: "defense"    },
  { symbol: "RTX",   name: "Raytheon",              group: "defense"    },
  { symbol: "BA",    name: "Boeing",                group: "defense"    },
];

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4시간

// 테이블 없으면 자동 생성
async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SpaceXQuant" (
      "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "symbol"     TEXT UNIQUE NOT NULL,
      "name"       TEXT NOT NULL,
      "group"      TEXT NOT NULL,
      "price"      DOUBLE PRECISION,
      "change1d"   DOUBLE PRECISION,
      "change5d"   DOUBLE PRECISION,
      "volume"     BIGINT,
      "avgVolume"  BIGINT,
      "high52w"    DOUBLE PRECISION,
      "low52w"     DOUBLE PRECISION,
      "williamsR"  DOUBLE PRECISION,
      "rsi14"      DOUBLE PRECISION,
      "sma20"      DOUBLE PRECISION,
      "sma50"      DOUBLE PRECISION,
      "momentum20" DOUBLE PRECISION,
      "score"      DOUBLE PRECISION,
      "signal"     TEXT,
      "ohlcv"      JSONB,
      "updatedAt"  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// Yahoo Finance에서 OHLCV 가져오기
async function fetchOHLCV(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Yahoo Finance fetch failed: ${symbol}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${symbol}`);

  const timestamps: number[] = result.timestamp || [];
  const q = result.indicators.quote[0];
  const closes: number[] = q.close || [];
  const highs: number[]  = q.high  || [];
  const lows: number[]   = q.low   || [];
  const volumes: number[]= q.volume|| [];

  // 유효한 봉 필터
  const bars = timestamps.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    open:   q.open?.[i]   ?? null,
    high:   highs[i]      ?? null,
    low:    lows[i]       ?? null,
    close:  closes[i]     ?? null,
    volume: volumes[i]    ?? null,
  })).filter(b => b.close !== null);

  return bars;
}

// Williams %R (14-period)
function calcWilliamsR(bars: any[], period = 14): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  const hh = Math.max(...slice.map(b => b.high));
  const ll = Math.min(...slice.map(b => b.low));
  const close = bars[bars.length - 1].close;
  if (hh === ll) return -50;
  return ((hh - close) / (hh - ll)) * -100;
}

// RSI (14-period)
function calcRSI(bars: any[], period = 14): number | null {
  if (bars.length < period + 1) return null;
  const closes = bars.map(b => b.close);
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

// SMA
function calcSMA(bars: any[], period: number): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  return slice.reduce((s, b) => s + b.close, 0) / period;
}

// 20일 모멘텀 %
function calcMomentum(bars: any[], period = 20): number | null {
  if (bars.length < period + 1) return null;
  const cur  = bars[bars.length - 1].close;
  const prev = bars[bars.length - 1 - period].close;
  return ((cur - prev) / prev) * 100;
}

// 퀀트 점수 (-3 ~ +3)
function calcScore(wr: number | null, rsi: number | null, close: number, sma20: number | null, sma50: number | null, mom: number | null): number {
  let s = 0;
  if (wr !== null) {
    if (wr <= -80) s += 1.0;       // 과매도 (매수 기회)
    else if (wr >= -20) s -= 1.0;  // 과매수 (매도 주의)
    else if (wr <= -60) s += 0.5;
  }
  if (rsi !== null) {
    if (rsi < 30) s += 1.0;
    else if (rsi > 70) s -= 1.0;
    else if (rsi < 45) s += 0.3;
    else if (rsi > 55) s -= 0.3;
  }
  if (sma20 !== null) s += close > sma20 ? 0.5 : -0.5;
  if (sma50 !== null) s += close > sma50 ? 0.5 : -0.5;
  if (mom !== null) {
    if (mom > 15) s += 0.5;
    else if (mom > 5) s += 0.2;
    else if (mom < -15) s -= 0.5;
    else if (mom < -5) s -= 0.2;
  }
  return Math.max(-3, Math.min(3, Math.round(s * 10) / 10));
}

function scoreToSignal(score: number): string {
  if (score >= 1.5) return "BUY";
  if (score <= -1.5) return "SELL";
  if (score <= -0.5) return "AVOID";
  return "HOLD";
}

async function pruneStaleSymbols() {
  const valid = STOCKS.map(s => s.symbol);
  await prisma.spaceXQuant.deleteMany({
    where: { symbol: { notIn: valid } },
  });
}

async function refreshAll() {
  await pruneStaleSymbols();
  const results = await Promise.allSettled(
    STOCKS.map(async (s) => {
      let price: number | null = null;
      let change1d: number | null = null;
      let change5d: number | null = null;
      let volume: bigint = BigInt(0);
      let high52w: number | null = null;
      let low52w: number | null = null;
      let wr: number | null = null;
      let rsi: number | null = null;
      let sma20: number | null = null;
      let sma50: number | null = null;
      let mom: number | null = null;
      let score = 0;
      let ohlcv: any[] = [];

      try {
        const bars = await fetchOHLCV(s.symbol);
        const last = bars[bars.length - 1];
        const prev = bars[bars.length - 2];

        wr    = calcWilliamsR(bars);
        rsi   = calcRSI(bars);
        sma20 = calcSMA(bars, 20);
        sma50 = calcSMA(bars, 50);
        mom   = calcMomentum(bars);
        score = calcScore(wr, rsi, last.close, sma20, sma50, mom);
        price = last.close;
        change1d = prev ? ((last.close - prev.close) / prev.close) * 100 : null;
        const bar5 = bars.length >= 6 ? bars[bars.length - 6] : null;
        change5d = bar5 ? ((last.close - bar5.close) / bar5.close) * 100 : null;
        const highs52 = bars.map(b => b.high).filter(Boolean);
        const lows52  = bars.map(b => b.low).filter(Boolean);
        high52w = highs52.length ? Math.max(...highs52) : null;
        low52w  = lows52.length  ? Math.min(...lows52)  : null;
        volume  = BigInt(Math.round(last.volume ?? 0));
        ohlcv   = bars.slice(-60);
      } catch {
        // Yahoo Finance 실패 시 가격 없이 DB에 기록 (심볼은 목록에 표시)
      }

      await prisma.spaceXQuant.upsert({
        where: { symbol: s.symbol },
        update: {
          name: s.name, group: s.group,
          price, change1d, change5d, volume,
          high52w, low52w,
          williamsR: wr, rsi14: rsi,
          sma20, sma50, momentum20: mom,
          score, signal: scoreToSignal(score),
          ohlcv,
          updatedAt: new Date(),
        },
        create: {
          symbol: s.symbol, name: s.name, group: s.group,
          price, change1d, change5d, volume,
          high52w, low52w,
          williamsR: wr, rsi14: rsi,
          sma20, sma50, momentum20: mom,
          score, signal: scoreToSignal(score),
          ohlcv,
        },
      });
      return s.symbol;
    })
  );
  return results;
}

// BigInt → Number 변환 (JSON 직렬화 오류 방지)
function serializeStocks(rows: any[]) {
  return rows.map(r => ({
    ...r,
    volume:    r.volume    != null ? Number(r.volume)    : null,
    avgVolume: r.avgVolume != null ? Number(r.avgVolume) : null,
  }));
}

// GET: 캐시된 데이터 반환 (4시간 이내면 바로, 아니면 갱신)
export async function GET(req: NextRequest) {
  try {
    await ensureTable();
    const force = req.nextUrl.searchParams.get("refresh") === "1";

    const cached = await prisma.spaceXQuant.findMany({ orderBy: { group: "asc" } });
    const stale  = cached.length < STOCKS.length ||
      cached.some(r => Date.now() - new Date(r.updatedAt).getTime() > CACHE_TTL_MS);

    if (force || stale) {
      await refreshAll();
      const fresh = await prisma.spaceXQuant.findMany({ orderBy: { group: "asc" } });
      return NextResponse.json({ stocks: serializeStocks(fresh), refreshed: true });
    }

    return NextResponse.json({ stocks: serializeStocks(cached), refreshed: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: GitHub Actions 크론에서 호출 (강제 갱신)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await refreshAll();
  return NextResponse.json({ ok: true, updatedAt: new Date().toISOString() });
}
