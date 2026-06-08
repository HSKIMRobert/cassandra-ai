import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

export interface StockItem {
  rank: number;
  name: string;
  code?: string;
  price: string;
  change: string;
  changePercent?: number;
  volume?: string;
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
    if (s.changePercent !== undefined) {
      sumChange += s.changePercent;
      withChange++;
      if (s.changePercent > 0.5) gainers++;
      else if (s.changePercent < -0.5) losers++;
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

async function launchBrowser() {
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

export async function scrapeNaverFinance(): Promise<MarketData[]> {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
  );

  const results: MarketData[] = [];

  try {
    await page.goto("https://m.stock.naver.com/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const html = await page.content();
    const $ = cheerio.load(html);

    // 모바일 버전에서 종목 데이터 추출
    const extractItems = (selector: string, type: "name" | "price"): StockItem[] => {
      const items: StockItem[] = [];
      const elements = $(selector);
      elements.each((i, el) => {
        if (i >= 10) return false;

        const text = $(el).text().trim();
        const priceMatch = text.match(/([\d,]+)\s*([▲▼]?\s*[\d,.]+\s*\(?[+-]?\d+\.?\d*%?\)?)/);

        if (type === "name") {
          items.push({
            rank: i + 1,
            name: text.replace(/[\d,]+[▲▼].*/, "").trim() || text,
            price: "",
            change: "",
          });
        }
      });
      return items;
    };

    // 거래량 상위, 거래대금 상위 등은 JavaScript로 동적 로딩됨
    // → Puppeteer로 DOM 접근

    // 1. 코스닥 종목 추출 (종목명과 코드)
    const kosdaqStocks = await page.evaluate(() => {
      const items: any[] = [];
      const links = document.querySelectorAll('a[href*="/item/"]');
      const seen = new Set();
      links.forEach((a, i) => {
        if (i >= 50) return;
        const href = a.getAttribute("href") || "";
        const match = href.match(/\/item\/(\d+)/);
        const name = a.textContent.trim();
        if (match && name && !seen.has(name)) {
          seen.add(name);
          items.push({ code: match[1], name, rank: items.length + 1 });
        }
      });
      return items;
    });

    // 2. 가격 정보 추출 (테이블에서)
    const priceData = await page.evaluate(() => {
      const rows: any[] = [];
      const trs = document.querySelectorAll("tr");
      trs.forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length >= 3) {
          const texts = Array.from(tds).map((td) => td.textContent.trim());
          rows.push({ name: texts[0], price: texts[1], change: texts[2] });
        }
      });
      return rows;
    });

    // 종목명 + 코드 매칭
    const merged: StockItem[] = [];
    for (const kos of kosdaqStocks.slice(0, 30)) {
      const priceMatch = priceData.find(
        (p) => p.name === kos.name || p.name.includes(kos.name) || kos.name.includes(p.name)
      );
      merged.push({
        rank: merged.length + 1,
        name: kos.name,
        code: kos.code,
        price: priceMatch?.price || "-",
        change: priceMatch?.change || "-",
        changePercent: parseChangePercent(priceMatch?.change || ""),
      });
    }

    if (merged.length > 0) {
      results.push({
        category: "TOP_VOLUME",
        stocks: merged.slice(0, 20),
        stats: computeStats(merged.slice(0, 20)),
      });
    }

    // 3. 코스닥 시세 페이지 추가 데이터
    await page.goto("https://m.stock.naver.com/marketindex/kosdaq/volume", {
      waitUntil: "networkidle2",
      timeout: 20000,
    }).catch(() => {});

    const volumeHtml = await page.content();
    const $$ = cheerio.load(volumeHtml);

    const volumeStocks: StockItem[] = [];
    $$("li").each((i, el) => {
      if (i >= 20) return false;
      const text = $$(el).text().trim();
      if (text && text.length > 3) {
        volumeStocks.push({
          rank: i + 1,
          name: text,
          price: "",
          change: "",
        });
      }
    });

    if (volumeStocks.length > 0) {
      results.push({
        category: "TOP_SEARCH",
        stocks: volumeStocks.slice(0, 20),
        stats: computeStats(volumeStocks.slice(0, 20)),
      });
    }
  } catch (err) {
    console.error("Naver scrape error:", err);
  } finally {
    await browser.close();
  }

  // 크롤링 실패 시 더미 데이터 반환 (개발용)
  if (results.length === 0) {
    results.push({
      category: "TOP_VOLUME",
      stocks: getDummyStocks(),
      stats: computeStats(getDummyStocks()),
    });
  }

  return results;
}

function parseChangePercent(change: string): number | undefined {
  const m = change.match(/([+-]?\d+\.?\d*)%/);
  if (m) {
    const pct = parseFloat(m[1]);
    if (change.includes("▼") || change.includes("-")) return -pct;
    return pct;
  }
  return undefined;
}

function getDummyStocks(): StockItem[] {
  return [
    { rank: 1, name: "CBI", code: "013290", price: "1,250", change: "▲120 (+10.6%)", changePercent: 10.6, volume: "12,345,678" },
    { rank: 2, name: "이엠앤아이", code: "EMNI00", price: "3,420", change: "▲250 (+7.9%)", changePercent: 7.9, volume: "8,765,432" },
    { rank: 3, name: "CG인바이츠", code: "CGINV0", price: "890", change: "▼45 (-4.8%)", changePercent: -4.8, volume: "5,432,109" },
    { rank: 4, name: "헬스커넥트", code: "HLCON0", price: "2,100", change: "▲310 (+17.3%)", changePercent: 17.3, volume: "15,678,901" },
    { rank: 5, name: "제이케이시냅스", code: "JKSYN0", price: "1,780", change: "▼120 (-6.3%)", changePercent: -6.3, volume: "3,210,987" },
    { rank: 6, name: "티쓰리", code: "T3COR0", price: "5,670", change: "▲30 (+0.5%)", changePercent: 0.5, volume: "2,345,678" },
    { rank: 7, name: "스틱인베스트먼트", code: "STKIN0", price: "6,890", change: "▼230 (-3.2%)", changePercent: -3.2, volume: "1,987,654" },
    { rank: 8, name: "인트로메딕", code: "150840", price: "4,320", change: "▲560 (+14.9%)", changePercent: 14.9, volume: "9,876,543" },
    { rank: 9, name: "엔켐", code: "999990", price: "22,450", change: "▲1,200 (+5.6%)", changePercent: 5.6, volume: "4,321,098" },
    { rank: 10, name: "씨아이테크", code: "999880", price: "3,150", change: "▼380 (-10.8%)", changePercent: -10.8, volume: "7,654,321" },
  ];
}
