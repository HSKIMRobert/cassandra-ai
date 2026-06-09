import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import { getCache, setCache } from "@/lib/redis-cache";
import fs from "fs";
import path from "path";

const DART_BASE = "https://opendart.fss.or.kr/api";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getDartKey() { return process.env.DART_API_KEY || ""; }
function monthsAgo(m: number) { const d = new Date(); d.setMonth(d.getMonth() - m); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); }

// DART 기업 매핑 + 지식베이스 (시작 시 1회 로드)
let dartCorps: any[] = [];
let knowledgeBase: any[] = [];
try {
  dartCorps = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "dart-corp-codes.json"), "utf-8"));
} catch {}
try {
  knowledgeBase = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "knowledge-base.json"), "utf-8"));
} catch {}

export async function POST(req: NextRequest) {
  const { query, period = 12 } = await req.json() as any;
  if (!query?.trim()) return NextResponse.json({ error: "질문을 입력하세요" }, { status: 400 });

  const dartKey = getDartKey();
  const bgnDe = monthsAgo(period);
  const endDe = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tokens = query.trim().split(/\s+/).filter((t: string) => t.length >= 2);
  const cacheKey = `chat:${query.trim().toLowerCase()}:${period}`;

  // 캐시 확인
  const cached = await getCache(cacheKey);
  if (cached) {
    return NextResponse.json(toJSON({
      ...cached.data,
      cached: true,
      cacheAge: Math.floor(cached.age / 60),
      cacheStale: cached.stale,
    }));
  }

  const results: any[] = [];

  // === 1. DB에서 회사 검색 ===
  for (const token of tokens) {
    const dbCorp = await prisma.corp.findFirst({
      where: { companyName: { contains: token, mode: "insensitive" } },
      include: { filings: { orderBy: { filedAt: "desc" }, take: 20 } },
    });
    if (dbCorp && dbCorp.filings.length > 0) {
      results.push(buildResult(dbCorp.companyName, dbCorp.corpCode, dbCorp.filings, "DB"));
    } else if (dbCorp) {
      // DB 회사는 있지만 공시 없음 → DART API 호출
      results.push({ companyName: dbCorp.companyName, corpCode: dbCorp.corpCode, totalDisclosures: 0, pendingDart: true });
    }
  }

  // === 2. DART API로 검색 (DB에 없거나 공시 0건) ===
  if (dartKey && results.every(r => r.totalDisclosures === 0 || r.pendingDart)) {
    for (const token of tokens) {
      // dart-corp-codes에서 회사 찾기
      const matches = dartCorps.filter((c: any) => c.name.includes(token)).slice(0, 3);
      for (const corp of matches) {
        const disclosures: any[] = [];
        for (const ty of ["B", "I"]) {
          try {
            const url = `${DART_BASE}/list.json?crtfc_key=${dartKey}&corp_code=${corp.corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=50`;
            const res = await fetch(url);
            const d = await res.json();
            if (d.status === "000" && d.list) disclosures.push(...d.list);
          } catch {}
          await sleep(80);
        }
        if (disclosures.length > 0) {
          results.push(buildResult(corp.name, corp.corp_code, disclosures, "DART"));
        }
      }
    }
  }

  // === 3. 인물 DB 검색 ===
  if (results.length === 0) {
    for (const token of tokens) {
      const person = await prisma.person.findFirst({
        where: { name: { contains: token, mode: "insensitive" } },
        include: { corpRelations: { include: { corp: true } } },
      });
      if (person) {
        for (const rel of person.corpRelations) {
          const filings = await prisma.filing.findMany({
            where: { corpId: rel.corp.id }, orderBy: { filedAt: "desc" }, take: 10,
          });
          results.push({
            personName: person.name, companyName: rel.corp.companyName, corpCode: rel.corp.corpCode,
            role: rel.role, totalDisclosures: filings.length,
            dartDisclosures: filings.map((f: any) => ({ title: f.title, date: f.filedAt?.toISOString()?.slice(0, 10) || "", rceptNo: f.rceptNo })),
          });
        }
      }
    }
  }

  // === 3.5 공시 본문 검색 (인물명이 DB에 없을 때) ===
  if (results.length === 0) {
    for (const token of tokens) {
      const filings = await prisma.filing.findMany({
        where: {
          OR: [{ title: { contains: token } }, { summary: { contains: token } }],
        },
        include: { corp: true },
        orderBy: { filedAt: "desc" },
        take: 10,
      });
      if (filings.length > 0) {
        const grouped = new Map<string, any[]>();
        for (const f of filings) {
          const key = f.corp.companyName;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(f);
        }
        for (const [company, items] of grouped) {
          results.push({
            personName: token, companyName: company, corpCode: items[0].corp.corpCode,
            role: `공시 ${items.length}건 언급`, totalDisclosures: items.length,
            dartDisclosures: items.map((f: any) => ({ title: f.title, date: f.filedAt?.toISOString()?.slice(0, 10) || "", rceptNo: f.rceptNo })),
          });
        }
      }
    }
  }

  // === 4. 최종 폴백: DART 실시간 전체 검색 ===
  if (results.length === 0 && dartKey) {
    // 4a. 지분공시(D)에서 인물명 검색
    const months3ago = monthsAgo(3);
    for (const token of tokens) {
      try {
        const url = `${DART_BASE}/list.json?crtfc_key=${dartKey}&bgn_de=${months3ago}&end_de=${endDe}&pblntf_ty=D&page_count=100`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === "000" && data.list) {
          const matches = data.list.filter((item: any) =>
            (item.flr_nm || "").includes(token) || (item.report_nm || "").includes(token)
          );
          if (matches.length > 0) {
            results.push({
              personName: token, companyName: matches[0].corp_name || "알수없음",
              role: `지분공시 ${matches.length}건`, totalDisclosures: matches.length,
              dartDisclosures: matches.slice(0, 10).map((item: any) => ({
                title: item.report_nm, date: item.rcept_dt, rceptNo: item.rcept_no,
              })),
            });
          }
        }
      } catch {}
    }

    // 4b. 전체 공시 검색
    if (results.length === 0) {
      try {
        const url = `${DART_BASE}/list.json?crtfc_key=${dartKey}&bgn_de=${bgnDe}&end_de=${endDe}&corp_cls=K&page_count=100`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === "000" && data.list) {
          for (const token of tokens) {
            const matches = data.list.filter((item: any) => item.corp_name?.includes(token));
            for (const corpName of [...new Set(matches.map((m: any) => m.corp_name))].slice(0, 3)) {
              const corpData = matches.filter((m: any) => m.corp_name === corpName);
              results.push({
                companyName: corpName, corpCode: corpData[0]?.corp_code || "",
                role: `DART ${corpData.length}건`, totalDisclosures: corpData.length,
                dartDisclosures: corpData.slice(0, 10).map((item: any) => ({ title: item.report_nm, date: item.rcept_dt, rceptNo: item.rcept_no })),
              });
            }
          }
        }
      } catch {}
    }
  }

  // === 지식베이스 ===
  const kbMatches = knowledgeBase.filter((kb: any) => tokens.some((t: string) => kb.name?.includes(t) || kb.aliases?.some((a: string) => a.includes(t))));

  const result = {
    results,
    summary: {
      query, period: `${period}개월`,
      foundCompanies: results.length,
      totalDisclosures: results.reduce((s: number, r: any) => s + (r.totalDisclosures || 0), 0),
      knowledge: kbMatches.length > 0 ? kbMatches : undefined,
      searchedAt: new Date().toISOString(),
    },
  };

  // 캐시 저장
  await setCache(cacheKey, result);

  return NextResponse.json(toJSON(result));
}

function buildResult(name: string, code: string, filings: any[], source: string) {
  const cats: Record<string, number> = {};
  filings.forEach((f: any) => {
    const t = f.title || f.report_nm || "";
    if (/전환사채|사채|CB/.test(t)) cats['CB'] = (cats['CB'] || 0) + 1;
    else if (/소송|판결|가처분/.test(t)) cats['소송'] = (cats['소송'] || 0) + 1;
    else if (/최대주주/.test(t)) cats['대주주'] = (cats['대주주'] || 0) + 1;
    else if (/유상증자|무상증자|감자/.test(t)) cats['증자/감자'] = (cats['증자/감자'] || 0) + 1;
    else if (/합병/.test(t)) cats['합병'] = (cats['합병'] || 0) + 1;
    else cats['기타'] = (cats['기타'] || 0) + 1;
  });
  return {
    companyName: name, corpCode: code, role: `${source} ${filings.length}건`,
    totalDisclosures: filings.length, categories: cats,
    dartDisclosures: filings.slice(0, 10).map((f: any) => ({
      title: f.title || f.report_nm || "", date: f.filedAt ? new Date(f.filedAt).toISOString().slice(0, 10) : (f.rcept_dt || ""), rceptNo: f.rceptNo || ""
    })),
  };
}
