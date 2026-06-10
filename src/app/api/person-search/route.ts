import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import { getCache, setCache } from "@/lib/redis-cache";
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
  const { name, period = 12 } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "이름을 입력하세요" }, { status: 400 });

  // 캐시 확인
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

  // 2.5 결과 부족 시 Puppeteer DART 스크래핑
  if (dedupedResults.length === 0 && filingList.length === 0) {
    try {
      const { searchDartPerson } = await import("@/lib/dart-scraper");
      const today = new Date();
      const start = new Date(today.getFullYear() - Math.floor(period / 12), today.getMonth(), today.getDate())
        .toISOString().slice(0, 10).replace(/-/g, "");
      const end = today.toISOString().slice(0, 10).replace(/-/g, "");

      const scraped = await searchDartPerson(name.trim(), start, end, 20);
      const grouped = new Map<string, any[]>();
      for (const item of scraped) {
        const key = item.companyName || "알수없음";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      }
      for (const [company, items] of grouped) {
        filingList.push({
          companyName: company, totalFilings: items.length, source: "DART 스크래핑",
          filings: items.map((item) => ({ title: item.reportName, date: item.date, rceptNo: item.rceptNo })),
        });
      }
    } catch {}
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

  const result = {
    persons: dedupedResults,
    filings: filingList,
    ranking: ranking.slice(0, 10),
    totalResults: dedupedResults.length + filingList.length,
  };

  await setCache(cacheKey, result);
  return NextResponse.json(toJSON(result));
}

export async function GET() {
  const ranking = loadRanking();
  return NextResponse.json(ranking.slice(0, 10));
}
