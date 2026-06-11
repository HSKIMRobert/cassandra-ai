/**
 * 관계망 테스트 — 모든 대시보드 기업 검증
 * 실행: npx tsx scripts/test-graph.ts
 */
import * as fs from "fs";
import * as path from "path";

const BASE_URL = process.env.TEST_URL || "http://localhost:3001";

async function testGraph(query: string): Promise<{ nodes: number; edges: number; ok: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/api/graph?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const nodes = data.nodes?.length || 0;
    const edges = data.edges?.length || 0;
    return { nodes, edges, ok: nodes > 1 && edges > 0 };
  } catch {
    return { nodes: 0, edges: 0, ok: false };
  }
}

async function main() {
  console.log("🔍 관계망 테스트 시작...\n");

  // 1. 지정 테스트 케이스
  const testCases = [
    { name: "CBI", expect: true },
    { name: "신승수", expect: true },
    { name: "에코심플렉스", expect: true },
    { name: "이노에이엑스", expect: true },
    { name: "핌스", expect: true },
  ];

  console.log("📋 지정 케이스:");
  let passCount = 0;
  for (const tc of testCases) {
    const result = await testGraph(tc.name);
    const status = result.ok ? "✅" : "❌";
    console.log(`  ${status} ${tc.name}: ${result.nodes} nodes, ${result.edges} edges`);
    if (result.ok) passCount++;
  }
  console.log(`  통과: ${passCount}/${testCases.length}\n`);

  // 2. 대시보드 기업 전체 테스트
  const reportPath = path.join(process.cwd(), "data", "kosdaq-anomaly-report.json");
  if (fs.existsSync(reportPath)) {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8"));
    const stocks = report.stocks || [];

    console.log(`📊 대시보드 기업 (${stocks.length}개):`);
    let dashboardPass = 0;
    let dashboardFail = 0;
    const failures: string[] = [];

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      const result = await testGraph(stock.name);
      if (result.ok) dashboardPass++;
      else { dashboardFail++; failures.push(stock.name); }

      if ((i + 1) % 20 === 0) {
        console.log(`  진행: ${i + 1}/${stocks.length} | 통과: ${dashboardPass} | 실패: ${dashboardFail}`);
      }
      await new Promise(r => setTimeout(r, 100)); // rate limit
    }

    console.log(`\n  ✅ 통과: ${dashboardPass}/${stocks.length} (${Math.round(dashboardPass/stocks.length*100)}%)`);
    console.log(`  ❌ 실패: ${dashboardFail}/${stocks.length}`);
    if (failures.length > 0) {
      console.log(`\n  실패 기업 (처음 10개):`);
      failures.slice(0, 10).forEach(f => console.log(`    - ${f}`));
      if (failures.length > 10) console.log(`    ... 외 ${failures.length - 10}개`);
    }

    // 결과 저장
    const outPath = path.join(process.cwd(), "Dart_Data", "graph-test-results.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({
      testedAt: new Date().toISOString(),
      passRate: Math.round(dashboardPass / stocks.length * 100),
      total: stocks.length, pass: dashboardPass, fail: dashboardFail,
      failures: failures.slice(0, 20),
    }, null, 2), "utf-8");
    console.log(`\n  결과 저장: ${outPath}`);
  } else {
    console.log("  ⚠️ kosdaq-anomaly-report.json 없음");
  }
}

main().catch(console.error);
