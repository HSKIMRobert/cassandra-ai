import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import { getCache, setCache } from "@/lib/redis-cache";
import { loadFromGitHubCache, saveToGitHubCache } from "@/lib/github-cache";
import fs from "fs";
import path from "path";

// 인물 검색 랭킹 저장
const RANKING_PATH = path.join(process.cwd(), "Dart_Data", "person-search-rank.json");

function loadRanking(): { query: string; count: number; lastSearched: string }[] {
  try { if (fs.existsSync(RANKING_PATH)) return JSON.parse(fs.readFileSync(RANKING_PATH, "utf-8")); }
  catch {}
  return [];
}

function saveRanking(ranking: any[]) {
  try { fs.writeFileSync(RANKING_PATH, JSON.stringify(ranking, null, 2), "utf-8"); } catch {}
}

export async function POST(req: NextRequest) {
  const { name, period = 12, scrape } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 });

  // 0. GitHub 캐시 확인 (가장 빠름)
  const githubCache = await loadFromGitHubCache("person", name.trim(), period);
  if (githubCache && !githubCache.stale) {
    return NextResponse.json(toJSON({ ...githubCache.data.results, fromGitHub: true }));
  }

  // 0.5 Redis/메모리 캐시 확인
  const cacheKey = `person:${name.trim()}:${period}`;
  const cached = await getCache(cacheKey);
  if (cached) return NextResponse.json(toJSON({ ...cached.data, cached: true }));

  const results: any[] = [];

  // 1. DB 인물 검색
  const persons = await prisma.person.findMany({
    where: { name: { contains: name.trim(), mode: "insensitive" } },
    include: {
      corpRelations: { include: { corp: true } },
      fundRelations: { include: { fund: true } },
    },
    take: 5,
  });

  for (const person of persons) {
    const corpList = person.corpRelations.map((r) => ({
      companyName: r.corp.companyName,
      corpCode: r.corp.corpCode,
      role: r.role,
      description: r.description,
    }));
    results.push({
      type: "DB",
      name: person.name,
      personUid: person.personUid,
      birthDate: person.birthDate,
      flags: person.flags,
      bio: person.bio,
      companies: corpList,
    });
  }

  // 동명이인 중복 제거 (name + birthDate 기준)
  const deduped = new Map<string, any>();
  for (const r of results) {
    const key = `${r.name}_${r.birthDate || "unknown"}`;
    if (deduped.has(key)) {
      const existing = deduped.get(key);
      existing.companies = [...existing.companies, ...r.companies];
      existing.flags = [...new Set([...(existing.flags || []), ...(r.flags || [])])];
    } else {
      deduped.set(key, { ...r });
    }
  }
  const dedupedResults = [...deduped.values()];
  let filingList: any[] = [];

  // 1.5 PersonHistory에서도 검색 (이력 데이터)
  if (dedupedResults.length === 0) {
    const historyRecords = await prisma.personHistory.findMany({
      where: { name: { contains: name.trim(), mode: "insensitive" } },
      select: { name: true, companyName: true, role: true, eventDate: true, eventType: true },
      orderBy: { eventDate: "desc" },
      take: 20,
    });
    const companyMap = new Map<string, { role: string; date: string }[]>();
    for (const h of historyRecords) {
      if (!companyMap.has(h.companyName)) companyMap.set(h.companyName, []);
      companyMap.get(h.companyName)!.push({ role: h.role, date: h.eventDate?.toISOString()?.slice(0, 10) || "" });
    }
    for (const [company, roles] of companyMap) {
      filingList.push({
        companyName: company,
        totalFilings: roles.length,
        source: "인물이력",
        filings: roles.map(r => ({ title: `${r.role}`, date: r.date, type: "PERSON_HISTORY" })),
      });
    }
  }

  // 동명이인 그룹 정보 추가
  for (const r of dedupedResults) {
    const group = await prisma.sameNameGroup.findFirst({ where: { name: r.name } });
    if (group) {
      r.sameNameCount = group.personIds.length;
      r.sameNameNote = group.note;
    }
  }

  // 2. DB 공시에서 이름 검색
  const filings = await prisma.filing.findMany({
    where: { title: { contains: name.trim() } },
    include: { corp: true },
    orderBy: { filedAt: "desc" },
    take: 20,
  });

  const filingResults = new Map<string, any>();
  for (const f of filings) {
    const key = f.corp.companyName;
    if (!filingResults.has(key)) {
      filingResults.set(key, { companyName: key, filings: [] });
    }
    filingResults.get(key)!.filings.push({
      title: f.title,
      date: f.filedAt.toISOString().slice(0, 10),
      type: f.filingType,
    });
  }

  const filingList = [...filingResults.values()].map((r) => ({
    ...r,
    totalFilings: r.filings.length,
    filings: r.filings.slice(0, 5),
  }));

  // 2.5 GitHub Actions 스크래핑 폴백 (사용자 요청 시)
  // Puppeteer는 GitHub Actions에서 실행, 여기서는 요청만 전달
  if (scrape) {
    // Actions가 완료되면 GitHub 캐시에서 결과를 읽을 수 있음
    // Actions 트리거는 프론트엔드에서 직접 GitHub API 호출
  }

  // 3. 랭킹 업데이트
  const ranking = loadRanking();
  const existing = ranking.find((r) => r.query === name.trim());
  if (existing) {
    existing.count++;
    existing.lastSearched = new Date().toISOString();
  } else {
    ranking.push({ query: name.trim(), count: 1, lastSearched: new Date().toISOString() });
  }
  ranking.sort((a, b) => b.count - a.count);
  saveRanking(ranking.slice(0, 20));

  // 빈도 3회 이상 → DB + JSON 영구 저장
  const rankEntry = ranking.find((r) => r.query === name.trim());
  if (rankEntry && rankEntry.count >= 3) {
    try {
      const persistPath = path.join(process.cwd(), "Dart_Data", "person-results", `${name.trim()}.json`);
      fs.mkdirSync(path.dirname(persistPath), { recursive: true });
      fs.writeFileSync(persistPath, JSON.stringify({
        name: name.trim(),
        searchCount: rankEntry.count,
        lastSearched: rankEntry.lastSearched,
        results: { persons: dedupedResults, filings: filingList },
      }, null, 2), "utf-8");

      // DB에도 저장
      const existingPerson = dedupedResults[0];
      if (existingPerson?.name) {
        await prisma.person.upsert({
          where: { personUid: `P-SEARCH-${name.trim()}` },
          update: { name: name.trim(), flags: { push: "frequent_search" } },
          create: { personUid: `P-SEARCH-${name.trim()}`, name: name.trim(), flags: ["frequent_search"] },
        });
      }
    } catch {}
  }

  const result = {
    persons: dedupedResults,
    filings: filingList,
    ranking: ranking.slice(0, 10),
    totalResults: dedupedResults.length + filingList.length,
    canScrape: !scrape && (dedupedResults.length + filingList.length === 0),
  };

  // 캐시 저장 (Redis + GitHub)
  await setCache(cacheKey, result);
  if (result.totalResults > 0) {
    saveToGitHubCache("person", name.trim(), period, result).catch(() => {});
  }

  return NextResponse.json(toJSON(result));
}

export async function GET() {
  const ranking = loadRanking();
  return NextResponse.json(ranking.slice(0, 10));
}
