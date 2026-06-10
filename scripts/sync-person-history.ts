/**
 * 인물 이력 자동 수집 (DART D-type 지분공시)
 * 실행: npx tsx scripts/sync-person-history.ts
 *
 * DART list.json?pblntf_ty=D → 제출인명(flr_nm) 파싱
 * → name+birthDate 중복 제거 → PersonHistory 저장
 * → GitHub+Redis+DB 동기화
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

// 인물명+생년월일 추출 정규식
function extractPersonInfo(title: string, flrNm: string): { name: string; birthDate?: string } | null {
  const name = flrNm?.trim();
  if (!name || name.length < 2) return null;
  // DART 보고서에서 생년월일 추출 시도 (예: "740108", "1974.01.08")
  const birthMatch = title.match(/(\d{6}|\d{4}\.\d{2}\.\d{2})/);
  let birthDate: string | undefined;
  if (birthMatch) {
    const raw = birthMatch[1].replace(/\./g, "");
    if (raw.length === 6) birthDate = raw; // YYMMDD → 그대로 사용
    else if (raw.length === 8) birthDate = raw; // YYYYMMDD
  }
  return { name, birthDate };
}

async function main() {
  if (!DART_KEY) { console.log("❌ DART_API_KEY 필요"); process.exit(1); }

  console.log(`📊 인물 이력 수집 [${new Date().toLocaleString("ko-KR")}]\n`);

  // 1. DART D-type 지분공시 수집 (3개월)
  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate() + 1);
  const bgnDe = threeMonthsAgo.toISOString().slice(0, 10).replace(/-/g, "");
  const endDe = today.toISOString().slice(0, 10).replace(/-/g, "");

  console.log(`기간: ${bgnDe}~${endDe}`);

  const allItems: any[] = [];
  for (let page = 1; page <= 5; page++) {
    try {
      const url = `${DART_BASE}/list.json?crtfc_key=${DART_KEY}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=D&page_count=100&page_no=${page}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === "000" && data.list) {
        allItems.push(...data.list);
        if (data.list.length < 100) break;
      } else break;
    } catch {}
    await sleep(200);
  }

  console.log(`수집: ${allItems.length}건`);

  // 2. 인물 추출 + 중복 제거
  const personMap = new Map<string, { name: string; birthDate?: string; items: any[] }>();
  for (const item of allItems) {
    const info = extractPersonInfo(item.report_nm || "", item.flr_nm || "");
    if (!info) continue;
    const key = `${info.name}_${info.birthDate || "unknown"}`;
    if (!personMap.has(key)) personMap.set(key, { ...info, items: [] });
    personMap.get(key)!.items.push(item);
  }

  console.log(`인물: ${personMap.size}명 (중복 제거 후)`);

  // 3. DB 저장
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    let saved = 0;

    for (const [key, info] of personMap) {
      const personUid = `DART-${key.replace(/[^a-zA-Z0-9가-힣]/g, "-")}`;

      // Person upsert
      await prisma.person.upsert({
        where: { personUid },
        update: { birthDate: info.birthDate },
        create: { personUid, name: info.name, birthDate: info.birthDate, flags: [] },
      }).catch(() => {});

      // 각 공시 → PersonHistory
      for (const item of info.items) {
        const title = item.report_nm || "";
        let role = "주요주주";
        let eventType = "HOLDING";
        if (/임원/.test(title)) { role = "임원"; eventType = "APPOINTED"; }
        if (/사임|퇴임/.test(title)) eventType = "RESIGNED";
        if (/대표이사/.test(title)) role = "대표이사";
        if (/사내이사/.test(title)) role = "사내이사";
        if (/사외이사/.test(title)) role = "사외이사";
        if (/감사/.test(title)) role = "감사";
        if (/대량보유/.test(title)) role = "주요주주";

        const dateStr = item.rcept_dt;
        const eventDate = new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`);

        await prisma.personHistory.upsert({
          where: { id: `ph-${item.rcept_no}-${personUid}` },
          update: {},
          create: {
            id: `ph-${item.rcept_no}-${personUid}`,
            personUid, name: info.name, birthDate: info.birthDate,
            companyName: item.corp_name || "", stockCode: item.stock_code,
            role, eventType, eventDate,
            sourceRceptNo: item.rcept_no, sourceTitle: title,
          },
        }).catch(() => {});
        saved++;

        // Corp 생성 + 관계 연결
        if (item.corp_code) {
          const corp = await prisma.corp.upsert({
            where: { corpCode: item.corp_code },
            update: { companyName: item.corp_name || "", stockCode: item.stock_code },
            create: { corpCode: item.corp_code, stockCode: item.stock_code, companyName: item.corp_name || "", market: "KOSDAQ" },
          }).catch(() => null);
          if (corp) {
            await prisma.corpPersonRelation.create({
              data: {
                personId: (await prisma.person.findUnique({ where: { personUid } }))?.id || "unknown",
                corpId: corp.id, role, since: eventDate,
                description: `${info.name} (${role}, DART ${item.rcept_no})`,
              },
            }).catch(() => {});
          }
        }
      }
    }

    console.log(`DB 저장: ${saved}건`);
    await prisma.$disconnect();
  } catch (e: any) {
    console.log(`DB 저장 스킵: ${e.message}`);
  }

  // 4. GitHub JSON 저장
  const outDir = path.join(process.cwd(), "Dart_Data", "person-history");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${today.toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify({
    generatedAt: today.toISOString(),
    totalDisclosures: allItems.length,
    uniquePersons: personMap.size,
    persons: [...personMap.entries()].map(([key, info]) => ({
      key, name: info.name, birthDate: info.birthDate, count: info.items.length,
    })),
  }, null, 2), "utf-8");

  console.log(`JSON 저장: ${outFile}\n`);
}

main().catch(console.error);
