/**
 * 일일 DART 공시 동기화 + 이상 징후 탐지
 * 실행: npx tsx scripts/daily-sync.ts [--limit 300]
 *
 * 매일 오전 9시, 오후 6시에 실행하여:
 * 1. DB Corp 기준 공시 수집 (dart-corp-codes.json 의존 제거)
 * 2. 6종 룰셋 적용 (사명변경, 대주주변경, 소송, CB, 증자, 리픽싱)
 * 3. DB 업데이트 + JSON 지식베이스 갱신
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { evaluateFilings, upsertSignals, RULES } from "../src/lib/risk-flags";

function getDartKey(): string {
  try {
    return process.env.DART_API_KEY ||
      ((fs.readFileSync(path.join(__dirname, "..", ".env"), "utf-8").match(/DART_API_KEY=(.+)/) || [])[1]?.trim() || "");
  } catch { return ""; }
}

const DART_KEY = getDartKey();
const DART_BASE = "https://opendart.fss.or.kr/api";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// CLI 인자
const cliArgs = process.argv.slice(2);
const limitArg = cliArgs.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(cliArgs[limitArg + 1], 10) : 300;

interface FilingItem {
  date: string; rceptNo: string; title: string; type: string;
}

interface CompanyReport {
  stockCode: string; corpCode: string; name: string; totalDisclosures: number;
  signals: { rule: string; weight: number; count: number; latestDate: string }[];
  riskScore: number;
  recentDisclosures: FilingItem[];
}

async function main() {
  if (!DART_KEY) { console.log("❌ DART_API_KEY 필요"); process.exit(1); }

  console.log(`📊 CASSANDRA AI — 일일 공시 동기화 [${new Date().toLocaleString("ko-KR")}]\n`);

  const prisma = new PrismaClient();

  // 1. DB Corp 기준 대상 기업 로드 (dart-corp-codes.json 불필요)
  const SPAC_KW = ["스팩", "SPAC", "기업인수목적"];
  const dbCorps = await prisma.corp.findMany({
    where: {
      delistedAt: null,
      corpCode: { not: "" },
      companyName: { not: { in: [] } }, // Prisma 필터용 placeholder
    },
    select: { id: true, corpCode: true, stockCode: true, companyName: true },
    orderBy: { createdAt: "desc" },
    take: LIMIT,
  });

  const targets = dbCorps.filter(c => !SPAC_KW.some(kw => c.companyName.includes(kw)));

  // 오늘 날짜
  const today = new Date();
  const isFirstRun = !fs.existsSync(path.join(__dirname, "..", "data", "daily-report.json"));
  const daysBack = isFirstRun ? 365 : 7;
  const bgnDe = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack)
    .toISOString().slice(0, 10).replace(/-/g, "");
  const endDe = today.toISOString().slice(0, 10).replace(/-/g, "");

  console.log(`대상: ${targets.length}개 기업 (DB Corp 기준) | ${isFirstRun ? "최초 실행 (12개월)" : "일일 (7일)"} | ${bgnDe}~${endDe}\n`);

  // 2. 공시 수집 + 룰셋 적용
  const reports: CompanyReport[] = [];
  let totalDisclosures = 0;
  let processed = 0;

  const BATCH = 100;
  for (let b = 0; b < targets.length; b += BATCH) {
    const batch = targets.slice(b, b + BATCH);

    for (const corp of batch) {
      processed++;
      const filings: FilingItem[] = [];

      for (const ty of ["B", "I"]) {
        try {
          const url = `${DART_BASE}/list.json?crtfc_key=${DART_KEY}&corp_code=${corp.corpCode}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=50`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.status === "000" && data.list) {
            for (const item of data.list) {
              filings.push({
                date: item.rcept_dt,
                rceptNo: item.rcept_no,
                title: item.report_nm || "",
                type: ty,
              });
            }
          }
        } catch {}
        await sleep(80);
      }

      const firingResults = evaluateFilings(filings.map(f => ({
        title: f.title,
        filedAt: `${f.date.slice(0,4)}-${f.date.slice(4,6)}-${f.date.slice(6,8)}`,
      })));
      const signals: CompanyReport["signals"] = firingResults.map(r => ({
        rule: r.label, weight: Math.round(r.score * 100), count: r.matchCount, latestDate: r.latestDate,
      }));
      const riskScore = Math.min(firingResults.reduce((s, r) => s + r.score * 100, 0), 100);

      if (filings.length > 0 || signals.length > 0) {
        reports.push({
          stockCode: corp.stockCode ?? "",
          corpCode: corp.corpCode,
          name: corp.companyName,
          totalDisclosures: filings.length,
          signals,
          riskScore: Math.min(riskScore, 100),
          recentDisclosures: filings.slice(0, 10),
        });
        totalDisclosures += filings.length;
      }

      if (processed % 20 === 0) {
        const withSignals = reports.filter((r) => r.signals.length > 0).length;
        console.log(`  진행: ${processed}/${targets.length} | 신호 ${withSignals}개 기업 | 공시 ${totalDisclosures}건`);
      }
    }

    if (b + BATCH < targets.length) {
      console.log(`  ⏸ 배치 완료, 3초 대기...`);
      await sleep(3000);
    }
  }

  // 3. 위험도순 정렬
  reports.sort((a, b) => b.riskScore - a.riskScore);

  // 4. JSON 저장
  const output = {
    generatedAt: new Date().toISOString(),
    period: { from: bgnDe, to: endDe },
    totalCompanies: reports.length,
    totalDisclosures,
    rules: RULES.filter(r => r.layer === "filing").map(r => ({ key: r.name, label: r.label, weight: r.weight })),
    highRisk: reports.filter((r) => r.riskScore >= 30),
    companies: reports,
  };

  const outPath = path.join(__dirname, "..", "data", "daily-report.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");

  // 5. 지식베이스 갱신
  const kbPath = path.join(__dirname, "..", "data", "dart-knowledge.json");
  if (fs.existsSync(kbPath)) {
    const kb = JSON.parse(fs.readFileSync(kbPath, "utf-8"));
    kb.generatedAt = new Date().toISOString();
    kb.dailyReport = {
      highRiskCount: output.highRisk.length,
      totalSignals: reports.reduce((s, r) => s + r.signals.length, 0),
      topRisks: output.highRisk.slice(0, 10).map((r) => ({ name: r.name, score: r.riskScore, signals: r.signals.map((s) => s.rule) })),
    };
    fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2), "utf-8");
  }

  // 6. 요약 출력
  console.log(`\n✅ 동기화 완료`);
  console.log(`   기업: ${reports.length}개 | 공시: ${totalDisclosures}건`);
  console.log(`   고위험(≥30): ${output.highRisk.length}개`);

  if (output.highRisk.length > 0) {
    console.log(`\n⚠️ 고위험 기업 Top 5:`);
    output.highRisk.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} (점수: ${r.riskScore})`);
      r.signals.forEach((s: any) => console.log(`     └ ${s.rule} ${s.count}건 (최근: ${s.latestDate})`));
    });
  }

  // 7. DB 공시 + 신호 저장
  let dbSaved = 0;
  for (const r of reports) {
    const dbCorp = await prisma.corp.upsert({
      where: { corpCode: r.corpCode },
      update: { companyName: r.name, stockCode: r.stockCode },
      create: { corpCode: r.corpCode, stockCode: r.stockCode, companyName: r.name, market: "KOSDAQ" },
    });
    for (const f of r.recentDisclosures) {
      try {
        await prisma.filing.upsert({
          where: { rceptNo: f.rceptNo },
          update: {},
          create: {
            rceptNo: f.rceptNo, corpId: dbCorp.id,
            filingType: f.type, title: f.title, summary: f.title,
            filedAt: new Date(`${f.date.slice(0,4)}-${f.date.slice(4,6)}-${f.date.slice(6,8)}`),
            sourceUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${f.rceptNo}`,
          },
        });
        dbSaved++;
      } catch {}
    }
    if (r.signals.length > 0) {
      await upsertSignals(dbCorp.id, r.signals.map(s => ({
        ruleName: s.rule, label: s.rule, score: s.weight / 100,
        matchCount: s.count, detail: `${s.rule} ${s.count}건 (최근: ${s.latestDate})`,
        latestDate: s.latestDate,
      }))).catch(() => {});
    }
  }
  console.log(`   DB 저장: ${dbSaved}건 공시`);

  try {
    const { cleanExpiredCache } = await import("../src/lib/github-cache");
    await cleanExpiredCache();
  } catch {}

  await prisma.$disconnect();
}

main().catch(console.error);
