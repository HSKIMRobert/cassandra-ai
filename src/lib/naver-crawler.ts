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

async function fetchStocks(
  sortType: string,
  pageSize: number
): Promise<StockItem[]> {
  const url = `https://m.stock.naver.com/api/stocks/marketValue/KOSDAQ?page=1&pageSize=${pageSize}&sortType=${sortType}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept": "application/json" },
  });
  const data = await res.json();
  const stocks: StockItem[] = [];

  for (let i = 0; i < (data.stocks || []).length; i++) {
    const s = data.stocks[i];
    const changeSign = s.compareToPreviousPrice?.code === "5" ? "-" :
                       s.compareToPreviousPrice?.code === "2" ? "+" : "";
    const changePercent = s.fluctuationsRatio ? parseFloat(s.fluctuationsRatio) : 0;
    const changeAbs = s.compareToPreviousClosePrice || "";

    stocks.push({
      rank: i + 1,
      name: s.stockName || "",
      code: s.itemCode || "",
      price: s.closePrice || "",
      change: changeSign
        ? `${changeSign}${changeAbs} (${changeSign}${Math.abs(changePercent)}%)`
        : `${changeAbs} (${changePercent}%)`,
      changePercent,
      volume: s.accumulatedTradingVolume
        ? Number(s.accumulatedTradingVolume).toLocaleString()
        : undefined,
      marketCap: s.marketValue
        ? (Number(s.marketValue) / 1e8).toFixed(0) + "억"
        : undefined,
    });
  }

  return stocks;
}

export async function scrapeNaverFinance(): Promise<MarketData[]> {
  const results: MarketData[] = [];

  try {
    // 1. 시가총액 상위
    const marketCapStocks = await fetchStocks("MARKET_VALUE", 20);
    results.push({
      category: "TOP_MARKET_CAP",
      stocks: marketCapStocks,
      stats: computeStats(marketCapStocks),
    });

    // 2. 거래량 상위
    const volumeStocks = await fetchStocks("ACCUMULATED_TRADING_VOLUME", 20);
    results.push({
      category: "TOP_VOLUME",
      stocks: volumeStocks,
      stats: computeStats(volumeStocks),
    });

    // 3. 등락률 상위 (급등)
    const gainerStocks = await fetchStocks("FLUCTUATION_RATE", 20);
    results.push({
      category: "TOP_GAINERS",
      stocks: gainerStocks,
      stats: computeStats(gainerStocks),
    });

    // 스냅샷 저장
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
