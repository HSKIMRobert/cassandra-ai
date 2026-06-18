/**
 * backtest-network.ts — 관계망 분석 백테스트
 * 실행: npx tsx scripts/backtest-network.ts
 * dry-run: DATABASE_URL 없이 모의 데이터로 출력 형식 검증
 */
import { PrismaClient } from "@prisma/client";
import { buildDeepGraph, getPersonTimeline, getAuditorRiskSummary } from "../src/lib/graph-queries";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.DATABASE_URL || process.argv.includes("--dry-run");

const TEST_QUERIES = ["신승수","오종원","인트로메딕","CBI인베스트먼트","이엠앤아이","티쓰리","헬스커넥트","코이엠앤아이"];

async function runDryRun() {
  console.log("=".repeat(60));
  console.log("CASSANDRA AI — 관계망 분석 백테스트 [DRY-RUN]");
  console.log("DATABASE_URL 없음 — 모의 데이터로 출력 형식 검증");
  console.log("=".repeat(60));

  const mockCoverage = [
    { query: "신승수",          hop1Nodes: 4,  hop2Nodes: 11, hop3Nodes: 18, hop2Gain: "+175%", hop3Gain: "+350%" },
    { query: "오종원",          hop1Nodes: 3,  hop2Nodes: 9,  hop3Nodes: 15, hop2Gain: "+200%", hop3Gain: "+400%" },
    { query: "인트로메딕",      hop1Nodes: 6,  hop2Nodes: 14, hop3Nodes: 22, hop2Gain: "+133%", hop3Gain: "+267%" },
    { query: "CBI인베스트먼트", hop1Nodes: 2,  hop2Nodes: 8,  hop3Nodes: 13, hop2Gain: "+300%", hop3Gain: "+550%" },
    { query: "이엠앤아이",      hop1Nodes: 3,  hop2Nodes: 7,  hop3Nodes: 11, hop2Gain: "+133%", hop3Gain: "+267%" },
  ];

  console.log("\n▶ [모의] Hop 커버리지 확장");
  console.table(mockCoverage.map(c => ({ 검색어: c.query, "1hop": c.hop1Nodes, "2hop": c.hop2Nodes, "3hop": c.hop3Nodes, "2hop증가": c.hop2Gain, "3hop증가": c.hop3Gain })));

  const avgH2 = mockCoverage.reduce((s,c) => s + parseInt(c.hop2Gain), 0) / mockCoverage.length;
  const avgH3 = mockCoverage.reduce((s,c) => s + parseInt(c.hop3Gain), 0) / mockCoverage.length;
  console.log(`\n▶ 평균 노드 증가율: 1→2hop +${avgH2.toFixed(0)}% / 1→3hop +${avgH3.toFixed(0)}%`);

  console.log("\n▶ [모의] 감사인 위험도");
  console.table([{ 감사인:"A회계법인", 감사기업수:7, 의심건수:4, 비적정의견:2, 위험도:"HIGH" }, { 감사인:"B회계법인", 감사기업수:5, 의심건수:1, 비적정의견:1, 위험도:"MEDIUM" }]);

  console.log("\n▶ [모의] CB 발행 고위험 기업");
  console.table([{ 기업명:"인트로메딕", CB발행횟수:5, 인물중복:"YES", 의심수준:"HIGH" }, { 기업명:"코이엠앤아이", CB발행횟수:3, 인물중복:"YES", 의심수준:"HIGH" }]);

  const fs = await import("fs");
  const report = { runAt: new Date().toISOString(), dryRun: true, coverageSummary: mockCoverage, summary: { totalQueries: 5, avgHop2NodeGain: Math.round(avgH2), avgHop3NodeGain: Math.round(avgH3), highRiskAuditors: 1, highSuspicionPersons: 2, cbCycleHigh: 2 } };
  fs.writeFileSync("Dart_Data/backtest-network-report.json", JSON.stringify(report, null, 2), "utf-8");
  console.log(`\n✅ DRY-RUN 완료 | 리포트: Dart_Data/backtest-network-report.json`);
  console.log(`실제 실행: DATABASE_URL=... npx tsx scripts/backtest-network.ts`);
}

async function main() {
  if (DRY_RUN) { await runDryRun(); return; }

  console.log("=".repeat(60));
  console.log("CASSANDRA AI — 관계망 분석 백테스트");
  console.log(`실행: ${new Date().toLocaleString("ko-KR")}`);
  console.log("=".repeat(60));

  for (const query of TEST_QUERIES) {
    process.stdout.write(`  ${query} ... `);
    let prev = 0;
    for (const hop of [1,2,3]) {
      const data = await buildDeepGraph(query, hop);
      const count = data.stats?.totalNodes ?? data.nodes.length;
      process.stdout.write(`${hop}hop:${count}(+${count-prev}) `);
      prev = count;
    }
    console.log();
  }

  await prisma.$disconnect();
  console.log("\n✅ 백테스트 완료");
}

main().catch(e => { console.error(e); process.exit(1); });
