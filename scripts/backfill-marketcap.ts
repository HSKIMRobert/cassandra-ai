/**
 * Corp 시가총액 백필 (Toss API 현재가 × DART 상장주식수)
 * 실행: npx tsx scripts/backfill-marketcap.ts [--limit 200]
 *
 * 완료 후 backfill-relations/backfill-filings에서 --cap-filter 5000억 이하 필터 사용 가능
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : 300;

const TOSS_BASE = "https://openapi.tossinvest.com";
let _token: { token: string; expiry: number } | null = null;

async function getTossToken(): Promise<string | null> {
  const id = process.env.TOSS_CLIENT_ID;
  const secret = process.env.TOSS_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (_token && Date.now() < _token.expiry) return _token.token;
  const res = await fetch(`${TOSS_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const d = await res.json();
  _token = { token: d.access_token, expiry: Date.now() + (d.expires_in - 3600) * 1000 };
  return _token.token;
}

// Toss API 배치 현재가
async function batchPrices(symbols: string[], token: string): Promise<Record<string, number>> {
  const url = new URL(`${TOSS_BASE}/api/v1/prices`);
  url.searchParams.set("symbols", symbols.join(","));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res?.ok) return {};
  const data = await res.json();
  const map: Record<string, number> = {};
  for (const item of (data.result ?? [])) map[item.symbol] = parseFloat(item.lastPrice) || 0;
  return map;
}

// DART 상장주식수
async function fetchListedShares(corpCode: string): Promise<number | null> {
  const key = process.env.DART_API_KEY;
  if (!key) return null;
  const url = `https://opendart.fss.or.kr/api/stockTotqySttus.json?crtfc_key=${key}&corp_code=${corpCode}&bsns_year=${new Date().getFullYear() - 1}&reprt_code=11011`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (data?.status !== "000" || !data.list?.length) return null;
  // 보통주 합계
  const ordinary = data.list.find((r: any) => r.se === "합계" || r.se === "보통주");
  if (!ordinary) return null;
  return parseInt(ordinary.istc_totqy?.replace(/,/g, "") || "0", 10) || null;
}

async function main() {
  const token = await getTossToken();
  if (!token) {
    console.error("❌ TOSS_CLIENT_ID/TOSS_CLIENT_SECRET 필요");
    process.exit(1);
  }

  console.log(`\n💰 시가총액 백필 (최대 ${LIMIT}개)\n`);

  const corps = await prisma.corp.findMany({
    where: { stockCode: { not: "" }, marketCap: null },
    select: { id: true, stockCode: true, corpCode: true, companyName: true },
    take: LIMIT,
  });

  console.log(`대상: ${corps.length}개 기업 (시총 미기입)\n`);

  // Toss 현재가 배치 (50개씩)
  const BATCH = 50;
  const priceMap: Record<string, number> = {};
  for (let i = 0; i < corps.length; i += BATCH) {
    const batch = corps.slice(i, i + BATCH);
    const symbols = batch.map(c => c.stockCode).filter(Boolean) as string[];
    const prices = await batchPrices(symbols, token);
    Object.assign(priceMap, prices);
    await sleep(300);
  }

  let updated = 0, skipped = 0;

  for (let i = 0; i < corps.length; i++) {
    const corp = corps[i];
    const price = priceMap[corp.stockCode || ""] || 0;
    if (!price) { skipped++; continue; }

    // 상장주식수 — DART API (느림, 필요 시만)
    const shares = await fetchListedShares(corp.corpCode);
    await sleep(200);

    if (!shares || shares === 0) { skipped++; continue; }

    const marketCap = BigInt(Math.round(price * shares));
    await prisma.corp.update({ where: { id: corp.id }, data: { marketCap } });
    updated++;

    const capB = Number(marketCap) / 1e8;
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
