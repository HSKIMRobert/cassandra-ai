import { prisma } from "./prisma";

export interface StockItem {
  rank: number;
  name: string;
  code: string;
  price: string;
  change: string;
  changePercent: number;
  volume?: string;
  marketCap?: string;
}

export interface MarketData {
  category: string;
  stocks: StockItem[];
  stats: {
    avgChangePercent: number;
    gainerCount: number;
    loserCount: number;
    neutralCount: number;
  };
}

function computeStats(stocks: StockItem[]) {
  let sumChange = 0;
  let gainers = 0;
  let losers = 0;
  let neutral = 0;
  let withChange = 0;

  for (const s of stocks) {
    if (s.changePercent !== undefined && !isNaN(s.changePercent)) {
      sumChange += s.changePercent;
      withChange++;
      if (s.changePercent > 1) gainers++;
      else if (s.changePercent < -1) losers++;
      else neutral++;
    } else {
      neutral++;
    }
  }

  return {
    avgChangePercent: withChange > 0 ? +(sumChange / withChange).toFixed(2) : 0,
    gainerCount: gainers,
    loserCount: losers,
    neutralCount: neutral,
  };
}

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15";

type RawStock = StockItem & { volumeRaw: number; marketCapRaw: number };

/** Naver marketValue API는 sortType을 무시하므로 풀을 받아 클라이언트 정렬 */
async function fetchKosdaqPool(pages = 5): Promise<RawStock[]> {
  const all: RawStock[] = [];
  for (let page = 1; page <= pages; page++) {
    const url =
      `https://m.stock.naver.com/api/stocks/marketValue/KOSDAQ` +
      `?page=${page}&pageSize=50&sortType=marketValue&t=${Date.now()}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null);
    if (!res?.ok) break;
    const data = await res.json().catch(() => null);
    const stocks = data?.stocks || [];
    if (!stocks.length) break;

    for (const s of stocks) {
      const changePercent = s.fluctuationsRatio ? parseFloat(s.fluctuationsRatio) : 0;
      const changeAbs = s.compareToPreviousClosePrice || "";
      const changeSign =
        s.compareToPreviousPrice?.code === "5" ? "-" :
        s.compareToPreviousPrice?.code === "2" ? "+" : "";
      const volumeRaw = s.accumulatedTradingVolume
        ? Number(String(s.accumulatedTradingVolume).replace(/,/g, ""))
        : 0;
      const marketCapRaw = s.marketValue
        ? Number(String(s.marketValue).replace(/,/g, ""))
        : 0;

      all.push({
        rank: 0,
        name: s.stockName || "",
        code: s.itemCode || "",
        price: s.closePrice || "",
        change: changeSign
          ? `${changeSign}${changeAbs} (${changeSign}${Math.abs(changePercent)}%)`
          : `${changeAbs} (${changePercent}%)`,
        changePercent,
        volume: volumeRaw ? volumeRaw.toLocaleString() : "-",
        marketCap: marketCapRaw ? marketCapRaw.toFixed(0) + "억" : "-",
        volumeRaw,
        marketCapRaw,
      });
    }
  }
  return all;
}

function sliceRanked(pool: RawStock[], mode: "cap" | "volume" | "gainers", n: number): StockItem[] {
  const sorted = [...pool];
  if (mode === "volume") sorted.sort((a, b) => b.volumeRaw - a.volumeRaw);
  else if (mode === "gainers") sorted.sort((a, b) => b.changePercent - a.changePercent);
  else sorted.sort((a, b) => b.marketCapRaw - a.marketCapRaw);

  return sorted.slice(0, n).map((s, i) => {
    const { volumeRaw: _v, marketCapRaw: _m, ...rest } = s;
    return { ...rest, rank: i + 1 };
  });
}

export async function scrapeNaverFinance(): Promise<MarketData[]> {
  const results: MarketData[] = [];

  try {
    const pool = await fetchKosdaqPool(5);

    const marketCapStocks = sliceRanked(pool, "cap", 20);
    results.push({
      category: "TOP_MARKET_CAP",
      stocks: marketCapStocks,
      stats: computeStats(marketCapStocks),
    });

    const volumeStocks = sliceRanked(pool, "volume", 20);
    results.push({
      category: "TOP_VOLUME",
      stocks: volumeStocks,
      stats: computeStats(volumeStocks),
    });

    const gainerStocks = sliceRanked(pool, "gainers", 20);
    results.push({
      category: "TOP_GAINERS",
      stocks: gainerStocks,
      stats: computeStats(gainerStocks),
    });

    for (const d of results) {
      await prisma.marketSnapshot.create({
        data: JSON.parse(JSON.stringify({
          category: d.category,
          data: d.stocks,
          stats: d.stats,
        })),
      });
    }
  } catch (err) {
    console.error("Naver Finance API error:", err);
  }

  return results;
}
