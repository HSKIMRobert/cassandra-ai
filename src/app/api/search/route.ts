import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";

  // 검색어 로깅 (비동기, 응답 지연 없음)
  if (q.trim()) {
    prisma.searchLog
      .create({
        data: { query: q.trim(), ip: req.headers.get("x-forwarded-for") || undefined },
      })
      .catch(() => {}); // 실패 무시
  }

  const data = await searchAll(q);
  return NextResponse.json(toJSON(data));
}

async function searchAll(query: string) {
  if (!query || query.length < 1) return { corps: [], persons: [], funds: [] };

  const [corps, persons, funds] = await Promise.all([
    prisma.corp.findMany({
      where: {
        OR: [
          { companyName: { contains: query, mode: "insensitive" } },
          { corpCode: { contains: query } },
          { stockCode: { contains: query } },
        ],
      },
      include: { _count: { select: { filings: true, signals: true } } },
      take: 10,
    }),
    prisma.person.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      include: { _count: { select: { corpRelations: true } } },
      take: 10,
    }),
    prisma.fund.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: 10,
    }),
  ]);

  return { corps, persons, funds };
}
