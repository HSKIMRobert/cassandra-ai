/**
 * DART 웹사이트 인물명 검색 (Puppeteer)
 * OpenAPI 미지원 → dsab007 본문 검색 스크래핑
 */

import puppeteer from "puppeteer";

export interface DartPersonResult {
  companyName: string;
  reportName: string;
  submitter: string;
  date: string;
  rceptNo: string;
}

export async function searchDartPerson(
  name: string,
  startDate: string,
  endDate: string,
  maxResults = 20
): Promise<DartPersonResult[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    );

    // DART 통합검색 페이지 로드
    await page.goto("https://dart.fss.or.kr/dsab007/main.do", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // 검색 조건 설정: 기간, 인물명, 본문검색
    await page.evaluate(
      (name, start, end) => {
        // 날짜 입력
        const startEl = document.querySelector<HTMLInputElement>('input[name="startDate"]');
        const endEl = document.querySelector<HTMLInputElement>('input[name="endDate"]');
        if (startEl) startEl.value = start;
        if (endEl) endEl.value = end;

        // 회사명 필드에 인물명 입력 (본문 검색 모드)
        const textEl = document.querySelector<HTMLInputElement>('input[name="textCrpNm"]');
        if (textEl) {
          textEl.value = name;
          // 검색 모드를 "본문내용"으로 변경
          const select = document.querySelector<HTMLSelectElement>('select[name="option"]');
          if (select) select.value = "report";
        }
      },
      name,
      startDate,
      endDate
    );

    // 검색 버튼 클릭
    await page.click('a.btn_search, input[type="submit"], button.search');
    await page.waitForTimeout(3000);

    // 결과 파싱
    const results = await page.evaluate(() => {
      const rows: any[] = [];
      const trs = document.querySelectorAll("table.tbWideList tbody tr");
      trs.forEach((tr) => {
        const tds = tr.querySelectorAll("td");
        if (tds.length >= 4) {
          const rceptLink = tds[1]?.querySelector("a");
          const rceptHref = rceptLink?.getAttribute("href") || "";
          const rceptMatch = rceptHref.match(/rcpNo=(\d+)/);
          rows.push({
            companyName: tds[0]?.textContent?.trim() || "",
            reportName: tds[1]?.textContent?.trim()?.replace(/\s+/g, " ") || "",
            submitter: tds[2]?.textContent?.trim() || "",
            date: tds[3]?.textContent?.trim() || "",
            rceptNo: rceptMatch ? rceptMatch[1] : "",
          });
        }
      });
      return rows;
    });

    return results.slice(0, maxResults);
  } catch (err) {
    console.error("DART Puppeteer error:", err);
    return [];
  } finally {
    await browser.close();
  }
}
