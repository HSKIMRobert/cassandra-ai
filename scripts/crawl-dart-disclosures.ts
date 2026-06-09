/**
 * 코스닥 전 종목 DART 공시 크롤링
 * 실행: npx tsx scripts/crawl-dart-disclosures.ts
 */

import * as fs from "fs";
import * as path from "path";

function getDartKey(): string {
  try {
    const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf-8");
    return (env.match(/DART_API_KEY=(.+)/) || [])[1]?.trim() || "";
  } catch { return ""; }
}

async function main() {
  const DART_KEY = getDartKey();
  if (!DART_KEY) { console.log("❌ DART_API_KEY 필요"); process.exit(1); }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  // DART 기업 목록 로드
  const dartCorps = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "dart-corp-codes.json"), "utf-8"));
  const SPAC = ["스팩", "SPAC", "기업인수목적"];
  const targets = dartCorps.filter((c: any) => !SPAC.some((kw) => c.name.includes(kw))).slice(0, 200);

  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const oneYearAgo = new Date(y - 1, m, d);
  const bgnDe = oneYearAgo.toISOString().slice(0, 10).replace(/-/g, "");
  const endDe = today.toISOString().slice(0, 10).replace(/-/g, "");
  const DART_BASE = "https://opendart.fss.or.kr/api";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  console.log(`📊 ${targets.length}개 기업 DART 크롤링\n`);

  let totalSaved = 0;
  for (let i = 0; i < targets.length; i++) {
    const corp = targets[i];

    // 1. 회사 등록
    const dbCorp = await prisma.corp.upsert({
      where: { corpCode: corp.corp_code },
      update: { companyName: corp.name, stockCode: corp.stock_code },
      create: { corpCode: corp.corp_code, stockCode: corp.stock_code, companyName: corp.name, market: "KOSDAQ" },
    });

    // 2. 공시 수집
    for (const ty of ["B", "F", "I"]) {
      try {
        const url = `${DART_BASE}/list.json?crtfc_key=${DART_KEY}&corp_code=${corp.corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=100`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "000" || !data.list) continue;

        for (const item of data.list) {
          try {
            await prisma.filing.upsert({
              where: { rceptNo: item.rcept_no },
              update: {},
              create: {
                rceptNo: item.rcept_no,
                corpId: dbCorp.id,
                filingType: detectType(item.report_nm),
                title: item.report_nm,
                summary: item.report_nm,
                filedAt: new Date(`${item.rcept_dt.slice(0,4)}-${item.rcept_dt.slice(4,6)}-${item.rcept_dt.slice(6,8)}`),
                sourceUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}`,
              },
            });
            totalSaved++;
          } catch {}
        }
      } catch {}
      await sleep(80);
    }

    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${targets.length} | ${totalSaved}건 저장`);
  }

  console.log(`\n✅ ${targets.length}개 기업, ${totalSaved}건 공시 저장 완료`);
  await prisma.$disconnect();
}

function detectType(title: string): string {
  if (/전환사채|신주인수권|CB|BW|사채/.test(title)) return "CB_ISSUANCE";
  if (/유상증자|무상증자|유무상증자/.test(title)) return "CAPITAL_INCREASE";
  if (/감자/.test(title)) return "CAPITAL_REDUCTION";
  if (/최대주주/.test(title)) return "MAJORITY_HOLDER_CHANGE";
  if (/임원|이사|감사/.test(title)) return "DIRECTOR_CHANGE";
  if (/소송|분쟁|경영권/.test(title)) return "LAWSUIT";
  if (/합병/.test(title)) return "MERGER";
  return "OTHER";
}

main().catch(console.error);
