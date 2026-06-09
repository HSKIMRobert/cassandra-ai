import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const trending = await prisma.searchLog.groupBy({
    by: ["query"],
    _count: { query: true },
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { _count: { query: "desc" } },
    take: 30, // 2자 이하 제거 후 10개 확보용
  });

  const filtered = trending
    .filter((t) => t.query.length >= 3) // 1-2자리 배제
    .slice(0, 10)
    .map((t) => ({ query: t.query, count: t._count.query }));

  return NextResponse.json(filtered);
}
