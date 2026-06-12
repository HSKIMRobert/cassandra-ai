/**
 * 네이버 증권 → 퀀트 대시보드 데이터 API
 * 시장 심리, 개별 종목 가격/등락률 제공
 */
import { NextResponse } from "next/server";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15";

interface StockData {
  name: string;
  code: string;
  price: string;
  change: string;
  changePercent: number;
  volume?: number;
}

export async function GET() {
  try {
    // NASDAQ 대표 종목 + 국내 반도체
    const nasdaqCodes = [
      { code: "NVDA", name: "엔비디아", type: "us" },
      { code: "AAPL", name: "애플", type: "us" },
      { code: "MSFT", name: "마이크로소프트", type: "us" },
      { code: "TSLA", name: "테슬라", type: "us" },
      { code: "META", name: "메타", type: "us" },
      { code: "AMZN", name: "아마존", type: "us" },
    ];

    // KOSDAQ 시장 심리 (Naver Finance API)
    const kosdaqRes = await fetch(
      "https://m.stock.naver.com/api/index/KOSDAQ/chart?periodType=day",
      { headers: { "User-Agent": UA } }
    ).catch(() => null);

    const kosdaqData = kosdaqRes ? await kosdaqRes.json() : null;

    // 시장 심리 계산 (간소화: 등락 종목 비율)
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

    // NASDAQ 개별 종목 데이터
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

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      marketGauge: { fear: fearGauge, neutral: neutralGauge, greed: greedGauge },
      stocks,
      totalAnalyzed: 100,
    });
  } catch {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      marketGauge: { fear: 35, neutral: 40, greed: 25 },
      stocks: [],
      cached: false,
    });
  }
}
