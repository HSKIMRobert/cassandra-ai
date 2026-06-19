/**
 * 특정 회사 임원 데이터 즉시 수집 (DART exctvSttus API)
 * 실행: npx tsx scripts/fetch-officers.ts "THE CUBE&"
 *       npx tsx scripts/fetch-officers.ts "회사명" 2023  (특정 연도)
 *
 * 수집 항목: 대표이사, 사내이사, 사외이사, 감사, 주요주주
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DART_BASE = "https://opendart.fss.or.kr/api";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getDartKey(): string {
  try { return process.env.DART_API_KEY || ((fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8").match(/DART_API_KEY=(.+)/) || [])[1]?.trim() || ""); }
  catch { return ""; }
}

const ROLE_MAP: Record<string, string> = {
  "대표이사": "CEO", "사내이사": "DIRECTOR", "사외이사": "OUTSIDE_DIRECTOR",
  "감사": "AUDITOR", "감사위원": "AUDITOR", "기타비상무이사": "DIRECTOR",
  "집행임원": "DIRECTOR", "이사회의장": "DIRECTOR",
};

async function fetchOfficers(corpCode: string, year: number) {
  // 보고서 코드: 11011=사업보고서, 11012=반기, 11013=1분기, 11014=3분기
  for (const reprt of ["11011", "11012"]) {
    try {
      const url = `${DART_BASE}/exctvSttus.json?crtfc_key=${getDartKey()}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprt}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "000" && data.list?.length > 0) {
        console.log(`  임원현황 ${year}년 (${reprt}): ${data.list.length}명`);
        return data.list;
      }
    } catch {}
  }
  return [];
}

async function fetchMajorShareholders(corpCode: string, year: number) {
  try {
    const url = `${DART_BASE}/majorstock.json?crtfc_key=${getDartKey()}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=11011`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "000" && data.list?.length > 0) {
      console.log(`  주요주주 ${year}년: ${data.list.length}명`);
      return data.list;
    }
  } catch {}
  return [];
}

async function main() {
  const DART_KEY = getDartKey();
  if (!DART_KEY) { console.log("❌ DART_API_KEY 없음 (.env 확인)"); process.exit(1); }

  const targetName = process.argv[2];
  if (!targetName) { console.log("사용법: npx tsx scripts/fetch-officers.ts \"회사명\""); process.exit(1); }

  const targetYear = parseInt(process.argv[3] || String(new Date().getFullYear() - 1));

  console.log(`\n🔍 "${targetName}" 임원 데이터 수집 (${targetYear}년)\n`);

  // 1. DB에서 corp 찾기
  const corp = await prisma.corp.findFirst({
    where: { companyName: { contains: targetName, mode: "insensitive" } },
  });

  if (!corp) {
    console.log(`❌ DB에 "${targetName}" 없음`);
    // dart-corp-codes.json에서 시도
    const dartCorps: any[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "dart-corp-codes.json"), "utf-8"));
    const match = dartCorps.find(c => c.name.includes(targetName) || targetName.includes(c.name));
    if (!match) { console.log("DART 코드도 없음"); await prisma.$disconnect(); process.exit(1); }
    console.log(`⚠ DB에 없으나 DART 코드 발견: ${match.corp_code} (${match.name}) — Corp 레코드를 먼저 생성하세요`);
    await prisma.$disconnect(); process.exit(1);
  }

  const corpCode = corp.corpCode;
  console.log(`✅ Corp: ${corp.companyName} (${corpCode}, stock: ${corp.stockCode})\n`);

  // 2. 임원 현황 수집
  const officers = await fetchOfficers(corpCode, targetYear);
  await sleep(300);

  // 3. 주요주주 수집
  const shareholders = await fetchMajorShareholders(corpCode, targetYear);
  await sleep(300);

  let saved = 0;

  // Person 찾거나 생성 (personUid 필수)
  async function findOrCreatePerson(name: string, birthDate?: string): Promise<any> {
    const existing = await prisma.person.findFirst({ where: { name, ...(birthDate ? { birthDate } : {}) } });
    if (existing) return existing;
    const personUid = `${name}-${birthDate || Date.now()}`.replace(/[^가-힣a-zA-Z0-9-]/g, "_");
    return prisma.person.create({ data: { name, birthDate: birthDate || undefined, personUid, flags: [] } });
  }

  // 4. 임원 → CorpPersonRelation 저장
  for (const o of officers) {
    const name = o.nm?.trim();
    if (!name || name.length < 2) continue;
    const rawRole = o.ofcps?.trim() || "DIRECTOR";
    const role = ROLE_MAP[rawRole] || "DIRECTOR";

    const person = await findOrCreatePerson(name, o.birth_dte?.trim() || undefined);

    await prisma.corpPersonRelation.upsert({
      where: { corpId_personId_role: { corpId: corp.id, personId: person.id, role } },
      update: { isCurrent: true },
      create: { corpId: corp.id, personId: person.id, role, isCurrent: true },
    });

    console.log(`  ✓ ${role}: ${name}`);
    saved++;
  }

  // 5. 주요주주 → CorpPersonRelation 저장
  for (const s of shareholders) {
    const name = s.nm?.trim();
    if (!name || name.length < 2) continue;
    const pct = parseFloat(s.stkqy_irds?.replace(/,/g, "") || "0");
    const role = pct >= 5 ? "LARGEST_HOLDER" : "INSIDER";

    const person = await findOrCreatePerson(name);

    await prisma.corpPersonRelation.upsert({
      where: { corpId_personId_role: { corpId: corp.id, personId: person.id, role } },
      update: { isCurrent: true },
      create: { corpId: corp.id, personId: person.id, role, isCurrent: true },
    });

    console.log(`  ✓ ${role} (${pct}%): ${name}`);
    saved++;
  }

  console.log(`\n✅ 완료: ${saved}건 저장 → "${corp.companyName}" 그래프에 인물 노드 표시됩니다`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
