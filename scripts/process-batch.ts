/**
 * 배치 분석 처리 — GitHub Actions (오전 6시/오후 3시/오후 9시 KST)
 * npx tsx scripts/process-batch.ts
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DART_BASE = "https://opendart.fss.or.kr/api";
const DART_VIEW = "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getDartKey() { return process.env.DART_API_KEY || (fs.existsSync(".env") ? (fs.readFileSync(".env","utf-8").match(/DART_API_KEY=(.+)/)?.[1]?.trim() || "") : ""); }
function getDSKey() { return process.env.DEEPSEEK_API_KEY || (fs.existsSync(".env") ? (fs.readFileSync(".env","utf-8").match(/DEEPSEEK_API_KEY=(.+)/)?.[1]?.trim() || "") : ""); }

function extractEntityName(raw: string): string {
  const cleaned = raw
    .replace(/\s*(분석해줘|분석해|분석요청|알려줘|조사해줘|검색해줘|이사진|주주|관계자|정보)\s*/g, " ")
    .replace(/\s*(을|를|의|에|과|와|이|가|은|는)\s*/g, " ")
    .trim();
  return cleaned.split(/\s+/)[0]?.trim() || raw.trim();
}

function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

/** 오늘(KST) 이미 완료된 동일 기업 BatchJob 찾기 → 재활용 */
async function findTodayDoneJob(targetName: string): Promise<any | null> {
  const searchName = extractEntityName(targetName);
  const todayStart = new Date(todayKST() + "T00:00:00+09:00");
  const todayEnd   = new Date(todayKST() + "T23:59:59+09:00");
  return prisma.batchJob.findFirst({
    where: {
      status: "DONE",
      reportPath: { not: null },
      processedAt: { gte: todayStart, lte: todayEnd },
      OR: [
        { targetName: { contains: searchName, mode: "insensitive" } },
        { targetName: { contains: targetName,  mode: "insensitive" } },
      ],
    },
    orderBy: { processedAt: "desc" },
  });
}

async function callDeepSeek(prompt: string): Promise<string> {
  const key = getDSKey();
  if (!key) return "⚠️ DEEPSEEK_API_KEY 미설정";
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "deepseek-chat", max_tokens: 2000, temperature: 0.3, messages: [
        { role: "system", content: "한국 코스닥 작전세력 탐지 전문가. DART 공시·임원이력·법인관계를 분석해 주의 패턴을 명확히 설명. 각 주장에는 제공된 공시 URL을 반드시 인용." },
        { role: "user", content: prompt },
      ] }),
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || "분석 실패";
  } catch (e: any) { return `DeepSeek 오류: ${e.message}`; }
}

async function fetchDartOfficers(corpCode: string, dk: string) {
  if (!dk || !corpCode) return [];
  try {
    const y = new Date().getFullYear() - 1;
    const r = await fetch(`${DART_BASE}/exctvSttus.json?crtfc_key=${dk}&corp_code=${corpCode}&bsns_year=${y}&reprt_code=11011`);
    const d = await r.json();
    return d.status === "000" ? (d.list || []) : [];
  } catch { return []; }
}

async function fetchDartShareholders(corpCode: string, dk: string) {
  if (!dk || !corpCode) return [];
  try {
    const y = new Date().getFullYear() - 1;
    const r = await fetch(`${DART_BASE}/majorstock.json?crtfc_key=${dk}&corp_code=${corpCode}&bsns_year=${y}&reprt_code=11011`);
    const d = await r.json();
    return d.status === "000" ? (d.list || []) : [];
  } catch { return []; }
}

/** DART 최신 공시 목록 (URL 포함) */
async function fetchRecentDartFilings(corpCode: string, dk: string, limit = 10) {
  if (!dk || !corpCode) return [];
  try {
    const r = await fetch(`${DART_BASE}/list.json?crtfc_key=${dk}&corp_code=${corpCode}&bgn_de=20240101&sort=date&sort_mth=desc&pblntf_ty=A&page_no=1&page_count=${limit}`);
    const d = await r.json();
    if (d.status !== "000") return [];
    return (d.list || []).map((item: any) => ({
      rceptNo: item.rcept_no,
      title: item.report_nm,
      date: item.rcept_dt?.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
      filerName: item.flr_nm,
      url: `${DART_VIEW}${item.rcept_no}`,
    }));
  } catch { return []; }
}

async function processCorpJob(job: any, dartKey: string) {
  const searchName = extractEntityName(job.targetName);
  const corp = await prisma.corp.findFirst({
    where: { companyName: { contains: searchName, mode: "insensitive" } },
    include: {
      filings: { orderBy: { filedAt: "desc" }, take: 30 },
      personRelations: { include: { person: true } },
      fundRelations: { include: { fund: true } },
      signals: { orderBy: { firedAt: "desc" }, take: 10 },
    },
  });
  if (!corp) return { result: `⏳ DB에 '${searchName}'(원본: '${job.targetName}') 없음 — fetch-officers로 수집 필요`, report: null };

  // 공시 카테고리 + URL
  const cats: Record<string, { count: number; items: { title: string; url: string; date: string }[] }> = {};
  for (const f of corp.filings) {
    const t = f.title || "";
    const cat = /전환사채|신주인수권|사채/.test(t) ? "CB/BW" : /소송|판결|가처분|회생/.test(t) ? "소송/분쟁" : /최대주주|대주주/.test(t) ? "대주주변경" : /유상증자|무상증자|감자|주식병합/.test(t) ? "증자/감자" : /상호변경|사명/.test(t) ? "사명변경" : /매매.*정지/.test(t) ? "매매정지" : /감사의견|감사인/.test(t) ? "감사리스크" : "기타";
    if (!cats[cat]) cats[cat] = { count: 0, items: [] };
    cats[cat].count++;
    if (cats[cat].items.length < 3) {
      const url = f.sourceUrl || (f.rceptNo ? `${DART_VIEW}${f.rceptNo}` : "");
      cats[cat].items.push({ title: f.title, url, date: f.filedAt.toISOString().slice(0,10) });
    }
  }

  await sleep(400);
  const dartOfficers = await fetchDartOfficers(corp.corpCode, dartKey);
  await sleep(400);
  const dartShareholders = await fetchDartShareholders(corp.corpCode, dartKey);
  await sleep(400);
  const recentFilings = await fetchRecentDartFilings(corp.corpCode, dartKey, 10);

  const dbPersons = corp.personRelations.map((r) => ({ name: r.person.name, role: r.role, flags: r.person.flags }));
  const seen = new Set(dbPersons.map((p) => p.name));
  for (const o of dartOfficers) { if (o.nm && !seen.has(o.nm)) { dbPersons.push({ name: o.nm, role: o.ofcps || "임원", flags: [] }); seen.add(o.nm); } }

  const personIds = corp.personRelations.map((r) => r.personId);
  let relatedCorps: any[] = [];
  if (personIds.length > 0) {
    const otherRels = await prisma.corpPersonRelation.findMany({ where: { personId: { in: personIds }, corpId: { not: corp.id } }, include: { corp: true, person: true }, take: 30 });
    relatedCorps = otherRels.map((r) => ({ personName: r.person.name, companyName: r.corp.companyName, role: r.role, since: r.since?.toISOString().slice(0,10), until: r.until?.toISOString().slice(0,10) }));
  }

  // AI 프롬프트에 공시 URL 포함
  const filingRefLines = Object.entries(cats).flatMap(([cat, v]) =>
    v.items.map(i => `  [${cat}] ${i.title} (${i.date})${i.url ? " → " + i.url : ""}`)
  ).join("\n");

  const recentRefLines = recentFilings.map((f: any) =>
    `  ${f.title} (${f.date})${f.filerName ? " / 제출: " + f.filerName : ""} → ${f.url}`
  ).join("\n");

  const prompt = `[분석대상] ${corp.companyName} (종목코드: ${corp.stockCode}, 시장: ${corp.market})

[공시 근거 — 아래 URL을 분석에 반드시 인용]
${filingRefLines || "없음"}

[최근 DART 공시 (최신순)]
${recentRefLines || "없음"}

[공시 유형별 건수]
${Object.entries(cats).map(([k,v])=>`- ${k}: ${v.count}건`).join("\n")}

[경영진]
${dbPersons.slice(0,10).map(p=>`- ${p.role}: ${p.name}`).join("\n") || "없음"}

[주요주주]
${dartShareholders.slice(0,5).map((s:any)=>`- ${s.nm} (${s.stkqy_irds}%)`).join("\n") || "없음"}

[경영진 연관기업 이력]
${relatedCorps.slice(0,10).map(r=>`- ${r.personName} → ${r.companyName}(${r.role})`).join("\n") || "없음"}

[위험시그널]
${corp.signals.slice(0,5).map(s=>`- ${s.ruleName}: ${s.score}점`).join("\n") || "없음"}

5가지 분석: 1.관계망요약 2.위험시그널(각 항목에 공시 URL 인용) 3.작전패턴 4.핵심역할 5.투자주의`;

  const aiAnalysis = await callDeepSeek(prompt);

  const result = `📊 ${corp.companyName} 분석완료\n\n${Object.entries(cats).map(([k,v])=>`· ${k}: ${v.count}건`).join("\n")}\n\n경영진: ${dbPersons.slice(0,5).map(p=>p.name).join(", ")||"없음"}\n연관기업: ${relatedCorps.length}건\n\n${aiAnalysis}\n\n✅ ${new Date().toLocaleString("ko-KR")}`;

  const report = {
    targetName: corp.companyName, targetType: "CORP", stockCode: corp.stockCode, market: corp.market,
    generatedAt: new Date().toISOString(),
    keyInfo: { corpCode: corp.corpCode, stockCode: corp.stockCode, market: corp.market, filingCount: corp.filings.length, signalCount: corp.signals.length, riskScore: corp.signals.reduce((s,x)=>s+x.score,0) },
    disclosureStats: Object.fromEntries(Object.entries(cats).map(([k,v])=>[k,v.count])),
    disclosureLinks: Object.fromEntries(Object.entries(cats).map(([k,v])=>[k, v.items])),
    recentFilings,
    officers: dbPersons,
    shareholders: dartShareholders.slice(0,10).map((s:any)=>({ name: s.nm, pct: s.stkqy_irds })),
    relatedCorps,
    signals: corp.signals.slice(0,10).map(s=>({ rule: s.ruleName, score: s.score, date: s.firedAt.toISOString().slice(0,10) })),
    aiAnalysis,
  };

  return { result, report };
}

async function processPersonJob(job: any) {
  const searchName = extractEntityName(job.targetName);
  const person = await prisma.person.findFirst({
    where: { name: { contains: searchName, mode: "insensitive" } },
    include: {
      corpRelations: { include: { corp: { include: { signals: { take: 3 }, filings: { orderBy: { filedAt: "desc" }, take: 5 } } } } },
      fundRelations: { include: { fund: true } },
    },
  });
  if (!person) return { result: `⏳ DB에 '${job.targetName}' 인물 없음`, report: null };

  const corpList = person.corpRelations.map((r) => ({
    name: r.corp.companyName, role: r.role,
    since: r.since?.toISOString().slice(0,10), until: r.until?.toISOString().slice(0,10),
    isCurrent: !r.until, riskScore: r.corp.signals.reduce((s,x)=>s+x.score,0),
    recentFilings: r.corp.filings.map(f => ({
      title: f.title, date: f.filedAt.toISOString().slice(0,10),
      url: f.sourceUrl || (f.rceptNo ? `${DART_VIEW}${f.rceptNo}` : ""),
    })),
  }));

  const filingRefLines = corpList.flatMap(c => c.recentFilings.map(f =>
    `  [${c.name}] ${f.title} (${f.date})${f.url ? " → " + f.url : ""}`
  )).slice(0, 15).join("\n");

  const prompt = `[분석인물] ${person.name}(${person.birthDate||"생년불명"})

[관련 공시 근거 — URL 인용]
${filingRefLines || "없음"}

[기업이력]
${corpList.map(c=>`- ${c.name}: ${c.role} (${c.since||"?"}~${c.until||"현재"}) 위험${c.riskScore}`).join("\n")}

[법인보유]
${person.fundRelations.map(r=>`- ${r.fund.name}: ${r.role}`).join("\n")||"없음"}

분석: 1.프로필 2.기업참여패턴(공시 URL 인용) 3.의심사항 4.투자주의`;

  const aiAnalysis = await callDeepSeek(prompt);
  const result = `👤 ${person.name} 분석완료\n\n연관기업: ${corpList.length}개\n고위험: ${corpList.filter(c=>c.riskScore>50).length}개\n\n${aiAnalysis}\n\n✅ ${new Date().toLocaleString("ko-KR")}`;
  const report = {
    targetName: person.name, targetType: "PERSON", birthDate: person.birthDate, bio: person.bio, flags: person.flags,
    generatedAt: new Date().toISOString(),
    corpHistory: corpList,
    fundList: person.fundRelations.map(r=>({ name: r.fund.name, role: r.role })),
    aiAnalysis,
  };
  return { result, report };
}

async function connectWithRetry(retries = 5, delayMs = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$connect();
      console.log("✅ DB 연결 성공");
      return;
    } catch (e: any) {
      console.log(`⏳ DB 연결 시도 ${i + 1}/${retries} 실패: ${e.message}`);
      if (i < retries - 1) await sleep(delayMs);
    }
  }
  throw new Error("DB 연결 실패 (5회 재시도 초과)");
}

async function main() {
  console.log(`📊 배치 분석 [${new Date().toLocaleString("ko-KR")}]\n`);
  const dartKey = getDartKey();

  await connectWithRetry();

  const jobs = await prisma.batchJob.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 10 });
  if (jobs.length === 0) { console.log("✅ 처리 대상 없음"); await prisma.$disconnect(); return; }
  console.log(`처리: ${jobs.length}건\n`);

  const reportsDir = path.join(process.cwd(), "Dart_Data", "reports");
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  for (const job of jobs) {
    console.log(`  → ${job.targetName} (${job.targetType})`);
    await prisma.batchJob.update({ where: { id: job.id }, data: { status: "PROCESSING" } });

    try {
      // ── 당일 동일 기업 재분석 방지 ──────────────────────────────
      const todayDone = await findTodayDoneJob(job.targetName);
      if (todayDone) {
        console.log(`  ♻️  오늘 분석 재활용 (${todayDone.targetName})`);
        await prisma.batchJob.update({ where: { id: job.id }, data: { status: "DONE", result: todayDone.result, reportPath: todayDone.reportPath, processedAt: new Date() } });
        const searchName = extractEntityName(job.targetName);
        const posts = await prisma.boardPost.findMany({
          where: {
            category: "ANALYSIS_REQUEST", status: { in: ["PENDING", "PROCESSING"] },
            OR: [
              { targetCorp: { contains: searchName, mode: "insensitive" } },
              { targetPerson: { contains: searchName, mode: "insensitive" } },
              { targetCorp: { contains: job.targetName, mode: "insensitive" } },
              { targetPerson: { contains: job.targetName, mode: "insensitive" } },
            ],
          },
        });
        for (const bp of posts) await prisma.boardPost.update({ where: { id: bp.id }, data: { analysis: todayDone.result, reportPath: todayDone.reportPath, status: "RESOLVED" } });
        console.log(`  📋 게시글 ${posts.length}건 RESOLVED (재활용)`);
        await sleep(500);
        continue;
      }

      // ── 신규 분석 ────────────────────────────────────────────────
      const { result, report } = job.targetType === "PERSON" ? await processPersonJob(job) : await processCorpJob(job, dartKey);

      let reportPath: string | null = null;
      if (report) {
        const safe = job.targetName.replace(/[^가-힣a-zA-Z0-9]/g, "_");
        reportPath = `Dart_Data/reports/${safe}.json`;
        fs.writeFileSync(path.join(process.cwd(), reportPath), JSON.stringify(report, null, 2), "utf-8");
      }

      await prisma.batchJob.update({ where: { id: job.id }, data: { status: "DONE", result, reportPath, processedAt: new Date() } });

      const searchName = extractEntityName(job.targetName);
      const matchingPosts = await prisma.boardPost.findMany({
        where: {
          category: "ANALYSIS_REQUEST", status: { in: ["PENDING", "PROCESSING"] },
          OR: [
            { targetCorp: { contains: searchName, mode: "insensitive" } },
            { targetPerson: { contains: searchName, mode: "insensitive" } },
            { targetCorp: { contains: job.targetName, mode: "insensitive" } },
            { targetPerson: { contains: job.targetName, mode: "insensitive" } },
          ],
        },
      });
      for (const bp of matchingPosts) {
        await prisma.boardPost.update({ where: { id: bp.id }, data: { analysis: result, reportPath, status: "RESOLVED" } });
      }
      console.log(`  📋 게시글 ${matchingPosts.length}건 RESOLVED`);
      console.log(`  ✅ ${job.targetName}${reportPath ? " → " + reportPath : ""}`);
    } catch (e: any) {
      console.error(`  ❌ ${job.targetName}: ${e.message}`);
      await prisma.batchJob.update({ where: { id: job.id }, data: { status: "FAILED", result: `오류: ${e.message}`, processedAt: new Date() } });
    }
    await sleep(1000);
  }

  await prisma.$disconnect();
  console.log("\n✅ 배치 완료");
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
