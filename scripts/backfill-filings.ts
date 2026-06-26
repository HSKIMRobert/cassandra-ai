/**
 * DB Corp 기준 공시 백필
 * 실행: npx tsx scripts/backfill-filings.ts [--limit 100] [--days 180] [--corp 회사명]
 *
 * DB에 있는 기업들의 DART 공시를 Filing 테이블에 연결
 */

import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { fetchRecentFilings } from "../src/lib/dart-parsers";
import { evaluateFilings, upsertSignals } from "../src/lib/risk-flags";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 100;
const daysArg = args.indexOf("--days");
const DAYS = daysArg !== -1 ? parseInt(args[daysArg + 1], 10) : 180;
const corpArg = args.indexOf("--corp");
const CORP_FILTER = corpArg !== -1 ? args[corpArg + 1] : null;
// 코스닥 시총 5000억 이하 필터 (--cap-filter 플래그)
const CAP_FILTER = args.includes("--cap-filter");
const CAP_THRESHOLD = BigInt(500_000_000_000); // 5000억원

async function main() {
  if (!process.env.DART_API_KEY) {
    console.error("❌ DART_API_KEY 환경변수 필요");
    process.exit(1);
  }

  console.log(`\n📑 공시 백필 시작 (최근 ${DAYS}일, 최대 ${LIMIT}개 기업)\n`);

  const corps = await prisma.corp.findMany({
    where: {
      corpCode: { not: "" },
      ...(CORP_FILTER ? { companyName: { contains: CORP_FILTER } } : {}),
      // --cap-filter: 시총 5000억 이하 (시총 미입력 기업 포함 — 소형주 가능성 높음)
      ...(CAP_FILTER ? { OR: [{ marketCap: { lte: CAP_THRESHOLD } }, { marketCap: null }] } : {}),
    },
    select: { id: true, corpCode: true, companyName: true, marketCap: true },
    orderBy: [{ marketCap: "asc" }, { companyName: "asc" }], // 소형주 우선
    take: LIMIT,
  });

  console.log(`대상: ${corps.length}개 기업\n`);

  let totalSaved = 0, totalSignals = 0, errors = 0;

  for (let i = 0; i < corps.length; i++) {
    const corp = corps[i];
    process.stdout.write(`[${i + 1}/${corps.length}] ${corp.companyName} (${corp.corpCode}) ... `);

    try {
      const filings = await fetchRecentFilings(corp.corpCode, DAYS);
      let saved = 0;

      for (const f of filings) {
        try {
          await prisma.filing.upsert({
            where: { rceptNo: f.rceptNo },
            update: {},
            create: {
              rceptNo: f.rceptNo,
              corpId: corp.id,
              filingType: f.type,
              title: f.title,
              summary: f.title,
              filedAt: new Date(f.filedAt),
              sourceUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${f.rceptNo}`,
            },
          });
          saved++;
        } catch { /* rceptNo unique 충돌 — 무시 */ }
      }

      // 리스크 신호 평가 + 저장
      const firingResults = evaluateFilings(
        filings.map(f => ({ title: f.title, filedAt: f.filedAt })),
      );
      if (firingResults.length > 0) {
        await upsertSignals(corp.id, firingResults);
        totalSignals += firingResults.length;
      }

      totalSaved += saved;
      console.log(`공시 ${saved}건 저장, 신호 ${firingResults.length}개`);
    } catch (e) {
      console.log(`❌ ${e instanceof Error ? e.message : String(e)}`);
      errors++;
    }

    await sleep(400); // DART API 레이트 리밋
  }

  console.log(`\n✅ 완료`);
  console.log(`  공시 저장: ${totalSaved}건`);
  console.log(`  리스크 신호: ${totalSignals}건`);
  console.log(`  오류: ${errors}개 기업`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
