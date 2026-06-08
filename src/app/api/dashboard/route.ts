import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toJSON } from "@/lib/serialize";
import { scrapeNaverFinance } from "@/lib/naver-crawler";

export async function GET() {
  try {
    // 최근 1시간 이내 스냅샷이 있으면 캐시 사용
    const recent = await prisma.marketSnapshot.findFirst({
      where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });

    if (recent) {
      const all = await prisma.marketSnapshot.findMany({
        where: {},
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      return NextResponse.json(toJSON({ snapshots: all, cached: true }));
    }

    // 크롤링 실행
    const data = await scrapeNaverFinance();

    for (const d of data) {
      await prisma.marketSnapshot.create({
        data: {
          category: d.category,
          data: d.stocks,
          stats: d.stats,
        },
      });
    }

    const all = await prisma.marketSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json(toJSON({ snapshots: all, cached: false }));
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "데이터를 불러올 수 없습니다" }, { status: 500 });
  }
}
