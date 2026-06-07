import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // 최근 24시간 동안의 검색어 집계
  const trending = await prisma.searchLog.groupBy({
    by: ["query"],
    _count: { query: true },
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { _count: { query: "desc" } },
    take: 10,
  });

  return NextResponse.json(
    trending.map((t) => ({ query: t.query, count: t._count.query }))
  );
}
