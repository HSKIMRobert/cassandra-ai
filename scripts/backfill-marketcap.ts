/**
 * Corp 시가총액 백필 (Naver Finance 시총 × 종목코드 매칭)
 * 실행: npx tsx scripts/backfill-marketcap.ts [--limit 200]
 *
 * 2026-07: Toss Open API IP 화이트리스트 정책으로 GHA/로컬 동적 IP에서
 * OAuth 실패 → Naver Finance marketValue API로 롤백.
 * 완료 후 backfill-relations/backfill-filings에서 --cap-filter 5000억 이하 필터 사용 가능
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 300;

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15";

/** Naver marketValue 단위: 억원 → Corp.marketCap(원) = 억원 * 1e8 */
async function fetchNaverMarketCaps(
  market: "KOSDAQ" | "KOSPI",
  maxPages = 40
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  for (let page = 1; page <= maxPages; page++) {
    const url =
      `https://m.stock.naver.com/api/stocks/marketValue/${market}` +
      `?page=${page}&pageSize=50&sortType=marketValue`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    }).catch(() => null);
    if (!res?.ok) break;
    const data = await res.json().catch(() => null);
    const stocks = data?.stocks ?? [];
    if (!stocks.length) break;
    for (const s of stocks) {
      const code = String(s.itemCode || "").trim();
      const raw = Number(String(s.marketValue ?? "").replace(/,/g, ""));
      if (!code || !raw) continue;
      // Naver mobile API: marketValue ≈ 억원
      map[code] = Math.round(raw * 1e8);
    }
    await sleep(120);
  }
  return map;
}

async function main() {
  console.log(`\n💰 시가총액 백필 — Naver Finance (최대 ${LIMIT}개)\n`);

  const [kosdaq, kospi] = await Promise.all([
    fetchNaverMarketCaps("KOSDAQ"),
    fetchNaverMarketCaps("KOSPI"),
  ]);
  const priceMap = { ...kospi, ...kosdaq };
  console.log(`Naver 시총 맵: KOSPI ${Object.keys(kospi).length} + KOSDAQ ${Object.keys(kosdaq).length}\n`);

  if (Object.keys(priceMap).length === 0) {
    console.error("❌ Naver marketValue 조회 실패 — 빈 맵");
    process.exit(1);
  }

  const corps = await prisma.corp.findMany({
    where: { stockCode: { not: "" }, marketCap: null },
    select: { id: true, stockCode: true, companyName: true },
    take: LIMIT,
  });

  console.log(`대상: ${corps.length}개 기업 (시총 미기입)\n`);

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < corps.length; i++) {
    const corp = corps[i];
    const cap = priceMap[corp.stockCode || ""] || 0;
    if (!cap) {
      skipped++;
      continue;
    }

    await prisma.corp.update({
      where: { id: corp.id },
      data: { marketCap: BigInt(cap) },
    });
    updated++;
    const capB = cap / 1e8;
    process.stdout.write(`[${i + 1}/${corps.length}] ${corp.companyName}: ${capB.toFixed(0)}억원\n`);
  }

  console.log(`\n✅ 완료: ${updated}개 업데이트, ${skipped}개 스킵`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
