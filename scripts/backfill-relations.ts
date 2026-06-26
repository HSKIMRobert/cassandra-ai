/**
 * 기존 DB의 Corp 데이터에서 관계망(CorpPersonRelation, CorpFundRelation) 재연결
 *
 * 실행: npx tsx scripts/backfill-relations.ts [--limit 50] [--corp 회사명]
 *
 * 1단계: DB Corp 목록 로드
 * 2단계: 각 기업의 DART 임원현황 + 최대주주 수집
 * 3단계: CorpPersonRelation upsert (중복 방지 — unique constraint 활용)
 * 4단계: 법인 주주 → CorpFundRelation upsert
 * 5단계: 감사의견 → CorpAuditRelation upsert
 */

import { PrismaClient } from "@prisma/client";
import { fetchOfficers, fetchMajorShareholders, fetchAuditOpinion } from "../src/lib/dart-parsers";
import { buildFundNodesFromShareholders, isFundEntity } from "../src/lib/fund-builder";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 100;
const corpArg = args.indexOf("--corp");
const CORP_FILTER = corpArg !== -1 ? args[corpArg + 1] : null;
const YEAR = new Date().getFullYear() - 1;

// personUid 생성 (일관성 유지)
function makePersonUid(name: string, birthDate?: string): string {
  return `${name}_${birthDate || "unknown"}`.replace(/[^가-힣a-zA-Z0-9_-]/g, "_");
}

async function findOrCreatePerson(name: string, birthDate?: string) {
  const personUid = makePersonUid(name, birthDate);
  const existing = await prisma.person.findFirst({
    where: { OR: [{ personUid }, { name, ...(birthDate ? { birthDate } : {}) }] },
  });
  if (existing) return existing;
  return prisma.person.create({ data: { name, birthDate, personUid, flags: [] } });
}

async function findOrCreateAuditor(name: string, firmType: string) {
  const existing = await prisma.auditorFirm.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.auditorFirm.create({ data: { name, firmType } });
}

async function processCorpRelations(corp: { id: string; corpCode: string; companyName: string }) {
  const { id: corpId, corpCode, companyName } = corp;
  let personCount = 0, fundCount = 0, auditCount = 0;

  // ── 임원현황 ──
  const officers = await fetchOfficers(corpCode, YEAR);
  await sleep(300);
  for (const o of officers) {
    try {
      const person = await findOrCreatePerson(o.name, o.birthDate);
      await prisma.corpPersonRelation.upsert({
        where: { corpId_personId_role: { corpId, personId: person.id, role: o.role } },
        update: { isCurrent: true },
        create: { corpId, personId: person.id, role: o.role, isCurrent: true },
      });
      personCount++;
    } catch { /* unique constraint race — 무시 */ }
  }

  // ── 최대주주 ──
  const shareholders = await fetchMajorShareholders(corpCode, YEAR);
  await sleep(300);
  for (const s of shareholders) {
    if (isFundEntity(s.name)) continue; // 법인은 아래에서 처리
    try {
      const person = await findOrCreatePerson(s.name);
      await prisma.corpPersonRelation.upsert({
        where: { corpId_personId_role: { corpId, personId: person.id, role: s.role } },
        update: { isCurrent: true },
        create: { corpId, personId: person.id, role: s.role, isCurrent: true },
      });
      personCount++;
    } catch {}
  }

  // ── 법인 주주 → Fund ──
  const fundPersons = shareholders.filter(s => isFundEntity(s.name));
  if (fundPersons.length > 0) {
    fundCount = await buildFundNodesFromShareholders(corpId, fundPersons, YEAR);
  }

  // ── 감사의견 ──
  const audit = await fetchAuditOpinion(corpCode, YEAR);
  await sleep(300);
  if (audit) {
    try {
      const auditor = await findOrCreateAuditor(audit.auditorName, audit.firmType);
      await prisma.corpAuditRelation.upsert({
        where: { corpId_auditorId_fiscalYear: { corpId, auditorId: auditor.id, fiscalYear: audit.fiscalYear } },
        update: { opinion: audit.opinion, isSuspicious: audit.isSuspicious },
        create: { corpId, auditorId: auditor.id, fiscalYear: audit.fiscalYear, opinion: audit.opinion, isSuspicious: audit.isSuspicious },
      });
      auditCount++;
    } catch {}
  }

  return { personCount, fundCount, auditCount };
}

async function main() {
  if (!process.env.DART_API_KEY) {
    console.error("❌ DART_API_KEY 환경변수 필요");
    process.exit(1);
  }

  console.log(`\n🔄 관계망 백필 시작 (${YEAR}년 기준, 최대 ${LIMIT}개)\n`);

  const where = CORP_FILTER
    ? { companyName: { contains: CORP_FILTER } }
    : {};

  const corps = await prisma.corp.findMany({
    where: { corpCode: { not: "" }, ...where },
    orderBy: { companyName: "asc" },
    take: LIMIT,
    select: { id: true, corpCode: true, companyName: true },
  });

  console.log(`대상: ${corps.length}개 기업\n`);

  let totalPersons = 0, totalFunds = 0, totalAudits = 0, errors = 0;

  for (let i = 0; i < corps.length; i++) {
    const corp = corps[i];
    process.stdout.write(`[${i + 1}/${corps.length}] ${corp.companyName} (${corp.corpCode}) ... `);
    try {
      const { personCount, fundCount, auditCount } = await processCorpRelations(corp);
      totalPersons += personCount;
      totalFunds += fundCount;
      totalAudits += auditCount;
      console.log(`인물 ${personCount}, 펀드 ${fundCount}, 감사 ${auditCount}`);
    } catch (e) {
      console.log(`❌ 오류: ${e instanceof Error ? e.message : String(e)}`);
      errors++;
    }
    // DART API 레이트 리밋 (초당 약 2건)
    await sleep(500);
  }

  console.log(`\n✅ 완료`);
  console.log(`  인물 관계: ${totalPersons}건`);
  console.log(`  펀드 관계: ${totalFunds}건`);
  console.log(`  감사 관계: ${totalAudits}건`);
  console.log(`  오류: ${errors}건`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
