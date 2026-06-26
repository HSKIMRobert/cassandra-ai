/**
 * 리스크 룰셋 백테스팅
 * 실행: npx tsx scripts/backtest-riskflags.ts [--days 365]
 *
 * 질문: "과거에 리스크 신호가 발화된 기업이 실제로 문제가 됐는가?"
 *
 * 측정 지표:
 *   - 신호 발화 → 30/60/90일 내 추가 공시(CB리픽싱, 소송, 감자 등) 발생률
 *   - 신호 발화 → 상장폐지/관리종목 편입 여부
 *   - 룰별 True Positive 추정율 (후속 위험 공시가 얼마나 나왔는지)
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { RULES } from "../src/lib/risk-flags";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const daysArg = args.indexOf("--days");
const DAYS = daysArg !== -1 ? parseInt(args[daysArg + 1], 10) : 365;

// 후속 위험 공시 패턴 (신호 발화 이후 나타나면 TP로 간주)
const OUTCOME_PATTERNS = [
  { label: "CB리픽싱",     pattern: /전환가액.*조정|리픽싱/ },
  { label: "관리종목",     pattern: /관리종목|거래정지/ },
  { label: "상장폐지",     pattern: /상장폐지/ },
  { label: "횡령배임",     pattern: /횡령|배임/ },
  { label: "감사의견거절", pattern: /감사의견.*거절|감사의견.*부적정/ },
  { label: "소송패소",     pattern: /소송.*패소|패소.*손해배상/ },
];

interface RuleBacktest {
  ruleName: string;
  label: string;
  totalFired: number;                            // 신호 발화 기업 수
  withOutcome: number;                           // 이후 위험 공시 발생 기업 수
  tpRate: number;                                // withOutcome / totalFired
  outcomes: { corpName: string; outcome: string; daysAfter: number }[];
}

async function main() {
  console.log(`\n🔬 리스크 룰셋 백테스팅 (최근 ${DAYS}일)\n`);

  const cutoff = new Date(Date.now() - DAYS * 86400 * 1000);

  // 기간 내 Signal 전체 로드
  const signals = await prisma.signal.findMany({
    where: { firedAt: { gte: cutoff } },
    include: { corp: { include: { filings: { orderBy: { filedAt: "asc" } } } } },
    orderBy: { firedAt: "asc" },
  });

  console.log(`분석 대상 신호: ${signals.length}건\n`);

  const ruleMap = new Map<string, RuleBacktest>();

  // 룰별 초기화
  for (const rule of RULES.filter(r => r.layer === "filing")) {
    ruleMap.set(rule.name, {
      ruleName: rule.name, label: rule.label,
      totalFired: 0, withOutcome: 0, tpRate: 0, outcomes: [],
    });
  }

  // 각 신호에 대해 후속 공시 검사
  for (const signal of signals) {
    const bt = ruleMap.get(signal.ruleName);
    if (!bt) continue;

    bt.totalFired++;
    const firedAt = signal.firedAt;

    // 신호 발화 이후 공시
    const subsequent = signal.corp.filings.filter(f => f.filedAt > firedAt);

    let hasOutcome = false;
    for (const filing of subsequent) {
      for (const outcome of OUTCOME_PATTERNS) {
        if (outcome.pattern.test(filing.title)) {
          const daysAfter = Math.round((filing.filedAt.getTime() - firedAt.getTime()) / 86400000);
          bt.outcomes.push({
            corpName: signal.corp.companyName,
            outcome: outcome.label,
            daysAfter,
          });
          hasOutcome = true;
          break;
        }
      }
      if (hasOutcome) break;
    }
    if (hasOutcome) bt.withOutcome++;
  }

  // TP Rate 계산
  const results: RuleBacktest[] = [];
  for (const bt of ruleMap.values()) {
    if (bt.totalFired === 0) continue;
    bt.tpRate = bt.withOutcome / bt.totalFired;
    results.push(bt);
  }

  results.sort((a, b) => b.tpRate - a.tpRate);

  // ── 출력 ──
  console.log("룰별 백테스팅 결과\n");
  console.log("룰명".padEnd(20) + "발화".padStart(6) + "후속위험".padStart(10) + "TP율".padStart(8));
  console.log("─".repeat(46));
  for (const bt of results) {
    const tpPct = (bt.tpRate * 100).toFixed(1) + "%";
    console.log(bt.label.padEnd(20) + String(bt.totalFired).padStart(6) + String(bt.withOutcome).padStart(10) + tpPct.padStart(8));
  }

  // 상위 TP 사례
  console.log("\n주요 적중 사례 (Top 10):\n");
  const allOutcomes = results.flatMap(bt =>
    bt.outcomes.map(o => ({ rule: bt.label, ...o }))
  ).sort((a, b) => a.daysAfter - b.daysAfter).slice(0, 10);

  for (const o of allOutcomes) {
    console.log(`  ${o.corpName} — [${o.rule}] 발화 후 ${o.daysAfter}일에 ${o.outcome}`);
  }

  // JSON 저장
  const out = {
    generatedAt: new Date().toISOString(),
    period: `최근 ${DAYS}일`,
    totalSignals: signals.length,
    rules: results.map(bt => ({
      ruleName: bt.ruleName, label: bt.label,
      totalFired: bt.totalFired, withOutcome: bt.withOutcome,
      tpRate: parseFloat((bt.tpRate * 100).toFixed(1)),
      topOutcomes: bt.outcomes.slice(0, 5),
    })),
  };
  const outPath = path.join(process.cwd(), "data", "backtest-result.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n✅ data/backtest-result.json 저장 완료`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
