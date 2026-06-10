/**
 * DART elestock.json API → 인물 정보 수집 (임원·주요주주 소유보고)
 * 실행: npx tsx scripts/sync-elestock.ts
 *
 * elestock.json: repror(보고자명), isu_exctv_ofcps(직위),
 * isu_exctv_rgist_at(등기여부), sp_stock_lmp_cnt(주식수)
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

// 회전 인덱스 파일
const ROTATION_PATH = path.join(process.cwd(), "Dart_Data", "elestock-rotation.json");

function loadRotation(): { lastBatch: number; processed: string[] } {
  try { if (fs.existsSync(ROTATION_PATH)) return JSON.parse(fs.readFileSync(ROTATION_PATH, "utf-8")); }
  catch {}
  return { lastBatch: 0, processed: [] };
}

function saveRotation(data: any) {
  fs.mkdirSync(path.dirname(ROTATION_PATH), { recursive: true });
  fs.writeFileSync(ROTATION_PATH, JSON.stringify(data, null, 2), "utf-8");
}

async function main() {
  if (!DART_KEY) { console.log("❌ DART_API_KEY 필요"); process.exit(1); }

  const dartCorps: any[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "dart-corp-codes.json"), "utf-8"));
  const SPAC = ["스팩", "SPAC", "기업인수목적"];
  const targets = dartCorps.filter((c: any) => !SPAC.some((kw) => c.name.includes(kw)));

  // 회전: 200개씩
  const BATCH_SIZE = 200;
  const rotation = loadRotation();
  const startIdx = rotation.lastBatch * BATCH_SIZE;
  const batch = targets.slice(startIdx, startIdx + BATCH_SIZE);

  if (batch.length === 0) {
    console.log("✅ 모든 회사 처리 완료. 인덱스 초기화...");
    rotation.lastBatch = 0;
    saveRotation(rotation);
    process.exit(0);
  }

  console.log(`📊 elestock 수집: 배치 ${rotation.lastBatch + 1}/${Math.ceil(targets.length / BATCH_SIZE)} (${batch.length}개사)\n`);

  const today = new Date();
  const year = today.getFullYear();
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  let totalPersons = 0;
  let saved = 0;

  for (let i = 0; i < batch.length; i++) {
    const corp = batch[i];
    try {
      // 최근 2개년 사업보고서 조회
      for (const yr of [year, year - 1]) {
        for (const reportCode of ["11011", "11012"]) { // 사업보고서, 반기보고서
          const url = `${DART_BASE}/api/elestock.json?crtfc_key=${DART_KEY}&corp_code=${corp.corp_code}&bsns_year=${yr}&reprt_code=${reportCode}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status !== "000" || !data.list) continue;

          for (const item of data.list) {
            const name = item.repror?.trim();
            if (!name || name.length < 2 || name === "없음") continue;

            const personUid = `ELESTOCK-${name.replace(/\s+/g, "-")}`;
            const role = item.isu_exctv_ofcps || item.isu_exctv_rgist_at || "임원";

            // PersonHistory 저장
            let bhDate: string | undefined;
            // elestock에는 birth_date 없음 → 추후 DS003에서 보완

            await prisma.personHistory.create({
              data: {
                personUid, name, role,
                companyName: corp.name, stockCode: corp.stock_code,
                eventType: "HOLDING",
                eventDate: new Date(`${yr}-03-31`),
                sourceRceptNo: item.rcept_no || `elestock-${corp.corp_code}-${yr}`,
                sourceTitle: `${corp.name} 임원·주요주주 소유보고 (${yr})`,
              },
            }).catch(() => {});
            saved++;
          }
        }
      }
    } catch {}
    await sleep(100);

    if ((i + 1) % 50 === 0) {
      console.log(`  ${i + 1}/${batch.length} | ${saved}건 저장`);
      // 중간 저장
      rotation.processed.push(...batch.slice(i - 49, i + 1).map((c: any) => c.corp_code));
      saveRotation(rotation);
    }
  }

  // 회전 인덱스 업데이트
  rotation.lastBatch++;
  saveRotation(rotation);

  console.log(`\n✅ 완료: ${saved}건 PersonHistory 저장`);
  console.log(`   진행률: ${Math.round((startIdx + batch.length) / targets.length * 100)}%`);
  console.log(`   다음 배치: ${rotation.lastBatch + 1}/${Math.ceil(targets.length / BATCH_SIZE)}`);

  // GitHub JSON 저장
  const outPath = path.join(process.cwd(), "Dart_Data", "elestock-people.json");
  const allHistory = await prisma.personHistory.findMany({
    where: { sourceTitle: { contains: "elestock" } },
    select: { name: true, companyName: true, role: true },
    take: 1000,
  });
  const uniquePeople = [...new Set(allHistory.map((h: any) => h.name))];
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalSaved: saved,
    uniquePeople: uniquePeople.length,
    progress: `${Math.round((startIdx + batch.length) / targets.length * 100)}%`,
  }, null, 2), "utf-8");

  await prisma.$disconnect();
}

main().catch(console.error);
