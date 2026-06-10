/**
 * GitHub Actions용 DART 인물 검색 스크래퍼
 * 실행: node scripts/scrape-person.js "신승수" 12
 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

const name = process.argv[2];
const period = parseInt(process.argv[3]) || 12;

if (!name) { console.log("Usage: node scrape-person.js <name> [period]"); process.exit(1); }

(async () => {
  console.log(`🔍 DART 인물 검색: ${name} (${period}개월)`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");

    const today = new Date();
    const start = new Date(today.getFullYear() - Math.floor(period / 12), today.getMonth(), today.getDate());
    const startStr = start.toISOString().slice(0, 10).replace(/-/g, "");
    const endStr = today.toISOString().slice(0, 10).replace(/-/g, "");

    // DART 검색 페이지 접속
    await page.goto("https://dart.fss.or.kr/dsab007/main.do", { waitUntil: "networkidle2" });

    // 검색 조건 입력
    await page.evaluate((n, s, e) => {
      const setVal = (name, val) => {
        const el = document.querySelector(`input[name="${name}"]`);
        if (el) el.value = val;
      };
      setVal("startDate", s);
      setVal("endDate", e);
      setVal("textCrpNm", n);
    }, name, startStr, endStr);

    // 검색 버튼 클릭
    await page.click("a.btn_search");
    await page.waitForTimeout(4000);

    // 결과 파싱
    const results = await page.evaluate(() => {
      const rows = [];
      document.querySelectorAll("table tbody tr").forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (tds.length >= 4) {
          const link = tds[1]?.querySelector("a")?.getAttribute("href") || "";
          rows.push({
            companyName: tds[0]?.textContent?.trim() || "",
            reportName: tds[1]?.textContent?.trim()?.replace(/\s+/g, " ") || "",
            submitter: tds[2]?.textContent?.trim() || "",
            date: tds[3]?.textContent?.trim() || "",
            rceptNo: (link.match(/rcpNo=(\d+)/) || [])[1] || "",
          });
        }
      });
      return rows;
    });

    // DOM 변경 감지: 결과가 없으면 selector 실패 가능성
    if (results.length === 0) {
      const pageText = await page.evaluate(() => document.body?.innerText || "");
      if (!pageText.includes("검색건수")) {
        console.log("  ⚠️ DART DOM 변경 감지 — 선택자 업데이트 필요");
        fs.writeFileSync(
          path.join(__dirname, "..", "Dart_Data", "person-results", `${name}-error.json`),
          JSON.stringify({ error: "DOM_CHANGED", name, message: "DART DOM 변경. 관리자에게 알려주세요.", checkedAt: new Date().toISOString() })
        );
      }
    }

    console.log(`  발견: ${results.length}건`);

    // 저장
    const dir = path.join(__dirname, "..", "Dart_Data", "person-results");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${name}.json`),
      JSON.stringify({
        name, period, generatedAt: new Date().toISOString(),
        totalResults: results.length,
        results: results.slice(0, 50),
      }, null, 2),
      "utf-8"
    );

    // DB 인덱스 업데이트
    try {
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();
      await prisma.searchCache.upsert({
        where: { type_query_period: { type: "person", query: name, period } },
        update: { resultCount: results.length, lastSearched: new Date(), searchCount: { increment: 1 } },
        create: { type: "person", query: name, period, githubPath: `Dart_Data/person-results/${name}.json`, resultCount: results.length, lastSearched: new Date(), expiresAt: new Date(Date.now() + 30 * 86400000) },
      });
      await prisma.$disconnect();
    } catch {}

    console.log(`  ✅ 저장 완료: Dart_Data/person-results/${name}.json`);
  } catch (err) {
    console.error("❌", err.message);
    // DOM 변경 가능성 저장
    try {
      const errFile = path.join(__dirname, "..", "Dart_Data", "person-results", `${name}-error.json`);
      require("fs").writeFileSync(errFile, JSON.stringify({
        error: "SCRAPE_FAILED", name,
        message: "DART DOM 변경. 관리자에게 알려주세요.",
        detail: err.message,
        checkedAt: new Date().toISOString(),
      }));
    } catch {}
    // DOM 변경은 에러지만 워크플로우 실패는 아님
    process.exit(0);
  } finally {
    await browser.close();
  }
})();
