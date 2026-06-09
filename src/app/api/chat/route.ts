import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import fs from "fs";
import path from "path";

// DART API 키 읽기
function getDartKey(): string {
  try {
    const env = fs.readFileSync(path.join(process.cwd(), ".env"), "utf-8");
    const m = env.match(/DART_API_KEY=(.+)/);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}

// DART 기업 매핑 (전체)
let dartCorps: { corp_code: string; name: string; stock_code: string }[] = [];
try {
  const mapPath = path.join(process.cwd(), "data", "dart-corp-codes.json");
  if (fs.existsSync(mapPath)) dartCorps = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
} catch {}

// DART corp_code 매핑 (stock_code → corp_code)
let dartCorpMap: Map<string, string> = new Map();
for (const item of dartCorps) dartCorpMap.set(item.stock_code, item.corp_code);

// 지식베이스 로드
let knowledgeBase: any[] = [];
try {
  const kbPath = path.join(process.cwd(), "data", "knowledge-base.json");
  if (fs.existsSync(kbPath)) knowledgeBase = JSON.parse(fs.readFileSync(kbPath, "utf-8"));
} catch {}

// 기간별 이전 날짜
function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { query, period = 12 } = body;

  if (!query?.trim()) {
    return NextResponse.json({ error: "질문을 입력하세요" }, { status: 400 });
  }

  const dartKey = getDartKey();
  const bgnDe = monthsAgo(period);
  const endDe = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  // 질문에서 인물명/회사명 추출
  const namePattern = /[가-힣]{2,}/g;
  const rawNames: string[] = query.match(namePattern) || [];
  const excludeWords = ["찾아줘", "분석", "관련", "추가", "알려줘", "검색", "변경", "최근", "법인", "회사", "기업", "공시", "요약"];
  const names = [...new Set(rawNames)].filter((n) => !excludeWords.includes(n));

  // 카테고리 감지
  const hasNameChange = /사명|상호|명칭/.test(query);
  const hasMajorHolder = /대주주|최대주주/.test(query);
  const hasLawsuit = /소송|분쟁|경영권/.test(query);
  const hasCB = /CB|사채|전환/.test(query);
  const activeCategories = { hasNameChange, hasMajorHolder, hasLawsuit, hasCB };
  const hasCategoryFilter = Object.values(activeCategories).some(Boolean);

  // 질문에서 회사명 찾기 (공시 요약, 최근 공시 등)
  const isCompanyQuery = /공시.*요약|최근.*공시|공시.*알려줘|공시.*찾아/.test(query);

  if (isCompanyQuery || names.some((n) => dartCorps.some((c) => c.name.includes(n)))) {
    // DART 매핑에서 회사 찾기
    const matchingCorps = dartCorps.filter(
      (c) => names.some((n) => c.name.includes(n))
    ).slice(0, 5);

    const companyResults: any[] = [];
    for (const corp of matchingCorps) {
      if (dartKey) {
        const disclosures: any[] = [];
        for (const ty of ["B", "F", "I"]) {
          try {
            const url = `${DART_BASE}/list.json?crtfc_key=${dartKey}&corp_code=${corp.corp_code}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=20`;
            const res = await fetch(url);
            const d = await res.json();
            if (d.status === "000" && d.list) disclosures.push(...d.list);
          } catch {}
          await sleep(100);
        }

        // 카테고리별 집계
        const categories: Record<string, number> = {};
        for (const item of disclosures) {
          const title = item.report_nm || "";
          if (/전환사채|신주인수권|사채/.test(title)) categories["CB/BW"] = (categories["CB/BW"] || 0) + 1;
          else if (/유상증자|무상증자|감자/.test(title)) categories["증자/감자"] = (categories["증자/감자"] || 0) + 1;
          else if (/최대주주|대주주/.test(title)) categories["최대주주"] = (categories["최대주주"] || 0) + 1;
          else if (/소송|분쟁/.test(title)) categories["소송/분쟁"] = (categories["소송/분쟁"] || 0) + 1;
          else if (/임원|이사|감사/.test(title)) categories["임원변경"] = (categories["임원변경"] || 0) + 1;
          else categories["기타"] = (categories["기타"] || 0) + 1;
        }

        companyResults.push({
          personName: "회사",
          companyName: corp.name,
          corpCode: corp.corp_code,
          stockCode: corp.stock_code,
          role: `${period}개월 공시 ${disclosures.length}건`,
          totalDisclosures: disclosures.length,
          categories,
          dartDisclosures: disclosures.slice(0, 10).map((item: any) => ({
            title: item.report_nm, date: item.rcept_dt, rceptNo: item.rcept_no,
          })),
          dbFilings: [],
        });
      }
    }

    if (companyResults.length > 0) {
      const summary = {
        query, period: `${period}개월`,
        foundPersons: 0, foundCompanies: companyResults.length,
        totalDisclosures: companyResults.reduce((s, r) => s + r.totalDisclosures, 0),
        knowledge: undefined,
        searchedAt: new Date().toISOString(),
      };
      return NextResponse.json(toJSON({ results: companyResults, summary }));
    }
  }

  // 2. 카테고리 필터가 있으면 DART 사전 데이터에서 필터링
  if (hasCategoryFilter) {
    const dartFiles: string[] = [];
    if (hasNameChange) dartFiles.push("dart-nameChanges-12m");
    if (hasMajorHolder) dartFiles.push("dart-majorHolderChanges-12m");
    if (hasLawsuit) dartFiles.push("dart-lawsuits-12m");
    if (hasCB) dartFiles.push("dart-cb-issuances-12m");

    const categoryResults: any[] = [];
    for (const file of dartFiles) {
      try {
        const filePath = path.join(process.cwd(), "data", `${file}.json`);
        if (!fs.existsSync(filePath)) continue;
        const dartData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const events = dartData.data || [];
        for (const e of events) {
          categoryResults.push({
            personName: "",
            companyName: e.companyName,
            corpCode: e.corpCode,
            stockCode: e.stockCode,
            marketCap: e.marketCap,
            role: e.category || file.replace("dart-", "").replace("-12m", ""),
            isAdmin: false,
            delistedAt: null,
            dartDisclosures: [{ title: e.reportName, date: e.date, rceptNo: e.rceptNo }],
            dbFilings: [],
            totalDisclosures: 1,
          });
        }
      } catch {}
    }

    // 인물 이름이 있으면 DB 교차 필터링
    if (names.length > 0) {
      for (const name of names) {
        const person = await prisma.person.findFirst({
          where: { name: { contains: name, mode: "insensitive" } },
          include: { corpRelations: { select: { corp: { select: { companyName: true } } } } },
        });
        if (person) {
          const personCorpNames = new Set(person.corpRelations.map((r) => r.corp.companyName));
          // categoryResults에서 인물과 연관된 회사만 필터링
          const filtered = categoryResults.filter((r) => personCorpNames.has(r.companyName));
          if (filtered.length > 0) {
            // 기존 DB 데이터로 풍부화
            for (const r of filtered) {
              r.personName = person.name;
              const corp = await prisma.corp.findFirst({
                where: { companyName: r.companyName },
                select: { corpCode: true, stockCode: true, marketCap: true, isAdmin: true, delistedAt: true },
              });
              if (corp) {
                r.corpCode = corp.corpCode;
                r.marketCap = corp.marketCap ? Number(corp.marketCap) / 1e8 : r.marketCap;
                r.isAdmin = corp.isAdmin;
                r.delistedAt = corp.delistedAt;
              }
            }
            const summary = {
              query, period: `${period}개월`,
              foundPersons: 1, foundCompanies: filtered.length,
              totalDisclosures: filtered.reduce((s, r) => s + r.totalDisclosures, 0),
              searchedAt: new Date().toISOString(),
            };
            return NextResponse.json(toJSON({ results: filtered, summary }));
          }
        }
      }
    }

    // 인물 필터 없으면 카테고리 결과 그대로 반환
    if (categoryResults.length > 0) {
      // 중복 제거
      const seen = new Set<string>();
      const unique = categoryResults.filter((r) => {
        const key = r.companyName + r.dartDisclosures[0]?.rceptNo;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 30);

      const summary = {
        query, period: `${period}개월`,
        foundPersons: 0, foundCompanies: unique.length,
        totalDisclosures: unique.length,
        searchedAt: new Date().toISOString(),
      };
      return NextResponse.json(toJSON({ results: unique, summary }));
    }
  }
  const results: any[] = [];
  const searchedCorps = new Set<string>();

  for (const name of names) {
    // DB에서 인물 검색
    const person = await prisma.person.findFirst({
      where: { name: { contains: name, mode: "insensitive" } },
      include: {
        corpRelations: {
          include: { corp: true },
        },
      },
    });

    if (person) {
      for (const rel of person.corpRelations) {
        const corpKey = rel.corp.corpCode;
        if (searchedCorps.has(corpKey)) continue;
        searchedCorps.add(corpKey);

        // DART 공시 검색
        let dartDisclosures: any[] = [];
        if (dartKey) {
          const corpCode = rel.corp.corpCode || dartCorpMap.get(rel.corp.stockCode || "");
          if (corpCode) {
            for (const ty of ["B", "F", "I"]) {
              try {
                const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${dartKey}&corp_code=${corpCode}&bgn_de=${bgnDe}&end_de=${endDe}&pblntf_ty=${ty}&page_count=30`;
                const res = await fetch(url);
                const d = await res.json();
                if (d.status === "000" && d.list) {
                  dartDisclosures.push(...d.list.map((item: any) => ({
                    title: item.report_nm,
                    date: item.rcept_dt,
                    rceptNo: item.rcept_no,
                  })));
                }
              } catch {}
              await new Promise((r) => setTimeout(r, 50));
            }
          }
        }

        // DB 공시
        const dbFilings = await prisma.filing.findMany({
          where: {
            corpId: rel.corp.id,
            filedAt: { gte: new Date(Date.now() - period * 30 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { filedAt: "desc" },
          take: 20,
        });

        results.push({
          personName: person.name,
          companyName: rel.corp.companyName,
          corpCode: rel.corp.corpCode,
          stockCode: rel.corp.stockCode,
          marketCap: rel.corp.marketCap ? Number(rel.corp.marketCap) / 1e8 : null,
          role: rel.role,
          isAdmin: rel.corp.isAdmin,
          delistedAt: rel.corp.delistedAt,
          dartDisclosures: dartDisclosures.slice(0, 20),
          dbFilings: dbFilings.map((f) => ({
            title: f.title,
            type: f.filingType,
            date: f.filedAt.toISOString(),
            summary: f.summary,
          })),
          totalDisclosures: dartDisclosures.length + dbFilings.length,
        });
      }
    }
  }

  // 3. DB에 없는 인물명은 DART만으로 검색 시도
  const foundNames = new Set(results.map((r) => r.personName));
  for (const name of names) {
    if (foundNames.has(name)) continue;

    // 이름으로 DB 검색 (부분 매칭)
    const filings = await prisma.filing.findMany({
      where: {
        OR: [
          { title: { contains: name } },
          { summary: { contains: name } },
        ],
        filedAt: { gte: new Date(Date.now() - period * 30 * 24 * 60 * 60 * 1000) },
      },
      include: { corp: true },
      orderBy: { filedAt: "desc" },
      take: 10,
    });

    if (filings.length > 0) {
      const corpSet = new Map<string, any>();
      for (const f of filings) {
        if (!corpSet.has(f.corp.id)) {
          corpSet.set(f.corp.id, {
            personName: name,
            companyName: f.corp.companyName,
            corpCode: f.corp.corpCode,
            stockCode: f.corp.stockCode,
            marketCap: f.corp.marketCap ? Number(f.corp.marketCap) / 1e8 : null,
            role: "언급됨",
            isAdmin: f.corp.isAdmin,
            delistedAt: f.corp.delistedAt,
            source: "DB 공시 내 언급",
            dbFilings: [],
            totalDisclosures: 0,
          });
        }
        corpSet.get(f.corp.id)!.dbFilings.push({
          title: f.title, type: f.filingType,
          date: f.filedAt.toISOString(), summary: f.summary,
        });
      }
      for (const c of corpSet.values()) {
        c.totalDisclosures = c.dbFilings.length;
        results.push(c);
      }
    }
  }

  // 4. DART API로 이름 검색 (DART list.json에서는 회사명 검색만 가능)
  // 이미 충분한 결과가 있으므로 생략

  // 5. 지식베이스 검색
  const kbMatches = knowledgeBase.filter((kb: any) =>
    names.some((n) => kb.name.includes(n) || kb.aliases?.some((a: string) => a.includes(n)))
  );

  const summary = {
    query,
    period: `${period}개월`,
    foundPersons: [...new Set(results.map((r) => r.personName))].length,
    foundCompanies: results.length,
    totalDisclosures: results.reduce((sum, r) => sum + r.totalDisclosures, 0),
    knowledge: kbMatches.length > 0 ? kbMatches : undefined,
    searchedAt: new Date().toISOString(),
  };

  return NextResponse.json(toJSON({ results, summary }));
}
