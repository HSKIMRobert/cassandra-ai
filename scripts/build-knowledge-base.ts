/**
 * DART 지식베이스 빌더 — LLM 학습용 JSON 생성
 * 실행: npx tsx scripts/build-knowledge-base.ts
 *
 * 모든 코스닥 한계기업의 12개월 공시를 수집하여
 * LLM이 읽기 쉬운 JSON 형식으로 저장
 */

import * as fs from "fs";
import * as path from "path";

function getDartKey(): string {
  try {
    const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf-8");
    return (env.match(/DART_API_KEY=(.+)/) || [])[1]?.trim() || "";
  } catch { return ""; }
}

async function main() {
  const DART_KEY = getDartKey();
  if (!DART_KEY) { console.log("❌ DART_API_KEY 필요"); process.exit(1); }

  // 대상 기업 로드
  const dartCorps = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "dart-corp-codes.json"), "utf-8"));
  const SPAC = ["스팩", "SPAC", "기업인수목적"];
  const targets = dartCorps.filter((c: any) => !SPAC.some((kw) => c.name.includes(kw))).slice(0, 300);

  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const oneYearAgo = new Date(y - 1, m, d);
  const bgnDe = oneYearAgo.toISOString().slice(0, 10).replace(/-/g, "");
  const endDe = today.toISOString().slice(0, 10).replace(/-/g, "");
  const DART_BASE = "https://opendart.fss.or.kr/api";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  console.log(`📊 ${targets.length}개 기업 DART 지식베이스 구축\n`);

  // 결과 데이터 구조
  const knowledgeBase: any = {
    generatedAt: new Date().toISOString(),
    totalCompanies: 0,
    totalDisclosures: 0,
    categories: {
      nameChanges: [] as any[],
      majorHolderChanges: [] as any[],
      lawsuits: [] as any[],
      cbIssuances: [] as any[],
      capitalChanges: [] as any[],
    },
    companies: {} as Record<string, any>,
  };

  for (let i = 0; i < targets.length; i++) {
    const corp = targets[i];
    const companyDisclosures: any[] = [];
    const personMentions = new Set<string>();

    for (const ty of ["B", "F", "I"]) {
      try {
        const url = `${DART_BASE}/list.json?crtfc_key=${DART_KEY}&corp_code=${corp.corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=100`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "000" || !data.list) continue;

        for (const item of data.list) {
          const title = item.report_nm || "";
          const entry: any = {
            date: item.rcept_dt,
            rceptNo: item.rcept_no,
            title,
            category: classify(title),
          };

          // 인물명 추출 (공시 제목에서)
          const personMatches = title.match(/[가-힣]{2,3}(?=\s*[\(\)측])/g) || [];
          personMatches.forEach((p: string) => personMentions.add(p));

          companyDisclosures.push(entry);

          // 카테고리별 분류
          if (entry.category === "NAME_CHANGE") knowledgeBase.categories.nameChanges.push({ company: corp.name, stockCode: corp.stock_code, ...entry });
          else if (entry.category === "MAJORITY_HOLDER_CHANGE") knowledgeBase.categories.majorHolderChanges.push({ company: corp.name, stockCode: corp.stock_code, ...entry });
          else if (entry.category === "LAWSUIT") knowledgeBase.categories.lawsuits.push({ company: corp.name, stockCode: corp.stock_code, ...entry });
          else if (entry.category === "CB_ISSUANCE") knowledgeBase.categories.cbIssuances.push({ company: corp.name, stockCode: corp.stock_code, ...entry });
          else if (entry.category === "CAPITAL_CHANGE") knowledgeBase.categories.capitalChanges.push({ company: corp.name, stockCode: corp.stock_code, ...entry });
        }
      } catch {}
      await sleep(80);
    }

    if (companyDisclosures.length > 0) {
      knowledgeBase.companies[corp.name] = {
        stockCode: corp.stock_code,
        corpCode: corp.corp_code,
        totalDisclosures: companyDisclosures.length,
        mentionedPersons: [...personMentions],
        disclosures: companyDisclosures,
      };
      knowledgeBase.totalCompanies++;
      knowledgeBase.totalDisclosures += companyDisclosures.length;
    }

    if ((i + 1) % 30 === 0) {
      console.log(`  ${i + 1}/${targets.length} | ${knowledgeBase.totalDisclosures}건 공시 | ${knowledgeBase.totalCompanies}개 기업`);
    }
  }

  // 저장
  const outPath = path.join(__dirname, "..", "data", "dart-knowledge.json");
  fs.writeFileSync(outPath, JSON.stringify(knowledgeBase, null, 2), "utf-8");

  console.log(`\n✅ 저장 완료: data/dart-knowledge.json`);
  console.log(`   ${knowledgeBase.totalCompanies}개 기업, ${knowledgeBase.totalDisclosures}건 공시`);
  console.log(`   사명변경: ${knowledgeBase.categories.nameChanges.length}건`);
  console.log(`   대주주변경: ${knowledgeBase.categories.majorHolderChanges.length}건`);
  console.log(`   소송/분쟁: ${knowledgeBase.categories.lawsuits.length}건`);
  console.log(`   CB 발행: ${knowledgeBase.categories.cbIssuances.length}건`);
  console.log(`   증자/감자: ${knowledgeBase.categories.capitalChanges.length}건`);
  console.log(`   파일 크기: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)}MB`);
}

function classify(title: string): string {
  if (/상호변경|사명변경/.test(title)) return "NAME_CHANGE";
  if (/최대주주/.test(title)) return "MAJORITY_HOLDER_CHANGE";
  if (/소송|분쟁|경영권|가처분|회생/.test(title)) return "LAWSUIT";
  if (/전환사채|신주인수권|사채/.test(title)) return "CB_ISSUANCE";
  if (/유상증자|무상증자|감자|주식병합/.test(title)) return "CAPITAL_CHANGE";
  return "OTHER";
}

main().catch(console.error);
