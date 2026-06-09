/**
 * DART 실공시 12개월 데이터 추출
 * 실행: npx tsx scripts/extract-dart-events.ts
 *
 * 추출 대상: 사명변경, 대주주변경, 사업목적추가, 소송/경영권분쟁
 */

import * as fs from "fs";
import * as path from "path";

// DART API 키 읽기
function getDartKey(): string {
  try {
    const envPath = path.join(__dirname, "..", ".env");
    const env = fs.readFileSync(envPath, "utf-8");
    const m = env.match(/DART_API_KEY=(.+)/);
    return m ? m[1].trim() : "";
  } catch { return ""; }
}

const DART_KEY = getDartKey();
const DART_BASE = "https://opendart.fss.or.kr/api";

// DART corp_code 매핑 로드
interface CorpEntry { corp_code: string; name: string; stock_code: string; }
let dartCorpMap: Map<string, CorpEntry> = new Map();
try {
  const mapPath = path.join(__dirname, "..", "data", "dart-corp-codes.json");
  if (fs.existsSync(mapPath)) {
    const data: CorpEntry[] = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
    for (const item of data) dartCorpMap.set(item.stock_code, item);
  }
} catch {}

// 시총 5000억 미만 필터링 (Naver 시가총액 데이터 사용)
let marketCaps: Map<string, number> = new Map();
try {
  const reportPath = path.join(__dirname, "..", "data", "kosdaq-anomaly-report.json");
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    for (const s of report.stocks || []) {
      const mv = s.marketCap ? parseInt(String(s.marketCap).replace(/[^0-9]/g, "")) : 0;
      if (mv > 0) marketCaps.set(s.code, mv);
    }
  }
} catch {}

function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface DartEvent {
  stockCode: string;
  corpCode: string;
  companyName: string;
  marketCap?: number;
  reportName: string;
  rceptNo: string;
  date: string;
  category: string;
}

async function main() {
  if (!DART_KEY) {
    console.log("❌ DART_API_KEY가 .env에 없습니다. npm run setup 으로 설정하세요.");
    process.exit(1);
  }

  console.log("📊 DART 12개월 이상 징후 데이터 추출 시작\n");

  const bgnDe = monthsAgo(12);
  const endDe = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // 검색 대상: 시총 5000억 미만 코스닥 기업
  const targetCodes: string[] = [];
  for (const [code, entry] of dartCorpMap) {
    const mv = marketCaps.get(code) || 0;
    if (mv > 0 && mv <= 5000) targetCodes.push(code);
  }

  // 시총 데이터가 없는 기업도 포함 (dart-corp-codes 전체 중 stock_code 있는 것만)
  if (targetCodes.length === 0) {
    for (const [code] of dartCorpMap) targetCodes.push(code);
  }
  // 최대 200개로 제한 (rate limit)
  const sampleCodes = targetCodes.slice(0, 200);

  console.log(`대상: ${sampleCodes.length}개 기업 (시총 5000억 미만 코스닥)`);

  const allEvents: Record<string, DartEvent[]> = {
    nameChanges: [],
    majorHolderChanges: [],
    purposeAdditions: [],
    lawsuits: [],
  };

  let processed = 0;
  for (const stockCode of sampleCodes) {
    const entry = dartCorpMap.get(stockCode);
    if (!entry) continue;

    // 주요사항보고(B) + 거래소공시(I)만 검색
    for (const ty of ["B", "I"]) {
      try {
        const url = `${DART_BASE}/list.json?crtfc_key=${DART_KEY}&corp_code=${entry.corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=50`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.status === "000" && data.list) {
          for (const item of data.list) {
            const title = item.report_nm || "";
            const baseEvent: Omit<DartEvent, "category"> = {
              stockCode,
              corpCode: entry.corp_code,
              companyName: item.corp_name || entry.name,
              marketCap: marketCaps.get(stockCode),
              reportName: title,
              rceptNo: item.rcept_no,
              date: item.rcept_dt,
            };

            if (/상호변경|사명변경|회사명\s*변경|명칭변경/.test(title)) {
              allEvents.nameChanges.push({ ...baseEvent, category: "사명변경" });
            }
            if (/최대주주\s*변경|대주주|경영권\s*양수|경영권\s*인수/.test(title)) {
              allEvents.majorHolderChanges.push({ ...baseEvent, category: "대주주변경" });
            }
            if (/사업목적\s*추가|사업다각화|신규사업|정관\s*변경/.test(title)) {
              allEvents.purposeAdditions.push({ ...baseEvent, category: "사업목적추가" });
            }
            if (/소송|분쟁|경영권|주주총회소집허가|가처분|주주제안|회생/.test(title)) {
              allEvents.lawsuits.push({ ...baseEvent, category: "소송/분쟁" });
            }
          }
        }
      } catch {}
      await sleep(100); // rate limit
    }

    processed++;
    if (processed % 20 === 0) {
      const total = Object.values(allEvents).reduce((s, a) => s + a.length, 0);
      console.log(`  진행: ${processed}/${sampleCodes.length} (이벤트 ${total}건)`);
    }
  }

  // 결과 저장
  const outputDir = path.join(__dirname, "..", "data");
  for (const [key, events] of Object.entries(allEvents)) {
    // 중복 제거
    const seen = new Set<string>();
    const unique = events.filter((e) => {
      const id = e.rceptNo;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    // 날짜순 정렬
    unique.sort((a, b) => b.date.localeCompare(a.date));

    const filePath = path.join(outputDir, `dart-${key}-12m.json`);
    fs.writeFileSync(filePath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      category: key,
      period: "12개월",
      totalCompanies: sampleCodes.length,
      events: unique.length,
      data: unique,
    }, null, 2), "utf-8");
  }

  // 요약 출력
  console.log("\n✅ 추출 완료:");
  for (const [key, events] of Object.entries(allEvents)) {
    console.log(`  dart-${key}-12m.json: ${events.length}건`);
  }

  const total = Object.values(allEvents).reduce((s, a) => s + a.length, 0);
  console.log(`\n총 ${total}건의 이상 징후 이벤트 추출 (${sampleCodes.length}개 기업 대상)`);
}

main().catch(console.error);
