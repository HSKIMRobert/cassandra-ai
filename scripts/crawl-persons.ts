/**
 * 인물 데이터 대량 갱신 — 지난 1년간 DART 공시 크롤링
 * 실행: npx tsx scripts/crawl-persons.ts
 *
 * 수집 대상:
 * - 주주, 신규 주주 회사, 조합, 조합 명부
 * - 이사 선임/해임/연임
 * - D-type(지분공시) + B-type(주요사항보고)
 */

import * as fs from "fs";
import * as path from "path";

function getDartKey(): string {
  try { return process.env.DART_API_KEY || ((fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8").match(/DART_API_KEY=(.+)/) || [])[1]?.trim() || ""); }
  catch { return ""; }
}

const DART_KEY = getDartKey();
const DART_BASE = "https://opendart.fss.or.kr/api";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PersonEntry {
  name: string;
  birthDate?: string;
  companyName: string;
  stockCode: string;
  role: string;
  eventType: string;
  eventDate: string;
  rceptNo: string;
  title: string;
}

async function main() {
  if (!DART_KEY) { console.log("❌ DART_API_KEY 필요"); process.exit(1); }

  console.log("📊 인물 데이터 대량 갱신 (지난 1년)\n");

  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate() + 1);
  const bgnDe = oneYearAgo.toISOString().slice(0, 10).replace(/-/g, "");
  const endDe = today.toISOString().slice(0, 10).replace(/-/g, "");

  console.log(`기간: ${bgnDe}~${endDe}`);

  // DART 기업 매핑 로드
  const dartCorps: any[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "dart-corp-codes.json"), "utf-8"));
  // DB에 있는 기업 + 시총 하위권 우선 (활성 기업)
  let targets;
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const dbCorps = await prisma.corp.findMany({ select: { corpCode: true, stockCode: true, companyName: true } });
    const dbCorpCodes = new Set(dbCorps.map((c: any) => c.corpCode));
    targets = dartCorps.filter((c: any) => dbCorpCodes.has(c.corp_code));
    await prisma.$disconnect();
  } catch {
    const SPAC = ["스팩", "SPAC", "기업인수목적"];
    targets = dartCorps.filter((c: any) => !SPAC.some((kw) => c.name.includes(kw))).slice(-500);
  }

  const allPersons: PersonEntry[] = [];
  const seen = new Set<string>();

  // 각 회사별로 D/B 타입 공시 검색
  console.log(`대상: ${targets.length}개사 (배치 50개씩)\n`);

  for (let i = 0; i < targets.length; i += 50) {
    const batch = targets.slice(i, i + 50);

    for (const corp of batch) {
      for (const ty of ["D", "B"]) {
        try {
          const url = `${DART_BASE}/list.json?crtfc_key=${DART_KEY}&corp_code=${corp.corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=100`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status !== "000" || !data.list) continue;

          for (const item of data.list) {
            const title = item.report_nm || "";
            const flrNm = item.flr_nm?.trim() || "";

            // 인물명 추출 (flr_nm 또는 report_nm에서)
            const personNames = new Set<string>();
            if (flrNm && flrNm.length >= 2 && flrNm !== corp.name && !flrNm.includes("주식회사") && !flrNm.includes("(주)") && !flrNm.includes("코스닥")) {
              personNames.add(flrNm);
            }

            // 역할 판별
            let role = "관계자";
            let eventType = "HOLDING";
            if (/대표이사|대표/.test(title)) role = "대표이사";
            if (/사내이사/.test(title)) role = "사내이사";
            if (/사외이사/.test(title)) role = "사외이사";
            if (/감사/.test(title)) role = "감사";
            if (/주요주주|대량보유|소유상황/.test(title)) role = "주요주주";
            if (/임원/.test(title)) role = "임원";
            if (/선임/.test(title)) eventType = "APPOINTED";
            if (/해임|사임|퇴임/.test(title)) eventType = "RESIGNED";
            if (/연임|재선임/.test(title)) eventType = "REAPPOINTED";
            if (/변경/.test(title)) eventType = "CHANGED";

            // 생년월일 추출
            let birthDate: string | undefined;
            const birthMatch = title.match(/(\d{6}|\d{4}\.\d{2}\.\d{2})/);
            if (birthMatch) {
              birthDate = birthMatch[1].replace(/\./g, "");
              if (birthDate.length === 8) birthDate = birthDate.slice(2); // YYYYMMDD → YYMMDD
            }

            for (const name of personNames) {
              const key = `${name}_${birthDate || "unknown"}_${corp.corp_code}_${item.rcept_no}_${role}`;
              if (seen.has(key)) continue;
              seen.add(key);

              allPersons.push({
                name, birthDate,
                companyName: corp.name,
                stockCode: corp.stock_code,
                role, eventType,
                eventDate: item.rcept_dt,
                rceptNo: item.rcept_no,
                title,
              });
            }
          }
        } catch {}
        await sleep(80);
      }
    }

    if ((i + 50) % 500 === 0) {
      console.log(`  진행: ${Math.min(i + 50, targets.length)}/${targets.length} | ${allPersons.length}명 수집`);
    }
  }

  console.log(`\n수집 완료: ${allPersons.length}건`);

  // 중복 제거 (name + birthDate + companyName 기준)
  const deduped = new Map<string, PersonEntry>();
  for (const p of allPersons) {
    const key = `${p.name}_${p.birthDate || "unknown"}_${p.companyName}`;
    if (!deduped.has(key)) deduped.set(key, p);
  }
  console.log(`중복 제거 후: ${deduped.size}명`);

  // DB 저장
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    let saved = 0, newCorps = 0;

    for (const p of deduped.values()) {
      const personUid = `DART-CRAWL-${p.name.replace(/[^a-zA-Z0-9가-힣]/g, "-")}`;
      const person = await prisma.person.upsert({
        where: { personUid },
        update: { birthDate: p.birthDate || undefined },
        create: { personUid, name: p.name, birthDate: p.birthDate || undefined, flags: [] },
      }).catch(() => null);
      if (!person) continue;

      // Corp upsert
      const corpEntry = dartCorps.find((c: any) => c.stock_code === p.stockCode);
      if (corpEntry) {
        const corp = await prisma.corp.upsert({
          where: { corpCode: corpEntry.corp_code },
          update: {},
          create: { corpCode: corpEntry.corp_code, stockCode: p.stockCode, companyName: p.companyName, market: "KOSDAQ" },
        }).catch(() => null);
        if (corp) {
          newCorps++;
          await prisma.corpPersonRelation.create({
            data: { personId: person.id, corpId: corp.id, role: p.role, since: new Date(p.eventDate.slice(0,4) + "-" + p.eventDate.slice(4,6) + "-" + p.eventDate.slice(6,8)), description: `${p.eventType}: ${p.title}` },
          }).catch(() => {});
        }
      }

      // PersonHistory 저장
      await prisma.personHistory.create({
        data: {
          personUid, name: p.name, birthDate: p.birthDate,
          companyName: p.companyName, stockCode: p.stockCode,
          role: p.role, eventType: p.eventType,
          eventDate: new Date(p.eventDate.slice(0,4) + "-" + p.eventDate.slice(4,6) + "-" + p.eventDate.slice(6,8)),
          sourceRceptNo: p.rceptNo, sourceTitle: p.title,
        },
      }).catch(() => {});
      saved++;
    }

    console.log(`DB 저장: ${saved}건 (신규 회사 ${newCorps}개)`);
    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`DB 저장 스킵: ${e.message}`);
  }

  // JSON 저장
  const outPath = path.join(process.cwd(), "Dart_Data", "person-crawl-1y.json");
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    period: { from: bgnDe, to: endDe },
    totalCollected: allPersons.length,
    uniquePersons: deduped.size,
    persons: [...deduped.values()].slice(0, 5000),
  }, null, 2), "utf-8");
  console.log(`JSON 저장: ${outPath}\n`);
}

main().catch(console.error);
