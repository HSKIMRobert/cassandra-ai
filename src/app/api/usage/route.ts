import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const counts = {
    corps: await prisma.corp.count(),
    persons: await prisma.person.count(),
    filings: await prisma.filing.count(),
    personHistory: await prisma.personHistory.count(),
    pageViews: await prisma.pageView.count(),
    searchCache: await prisma.searchCache.count(),
    boardPosts: await prisma.boardPost.count(),
    entityVotes: await prisma.entityVote.count(),
  };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const MAX = 125000; // Neon 0.5GB → 50% 안전선
  const usagePct = Math.round((total / MAX) * 100);

  return NextResponse.json({
    totalRecords: total,
    maxRecords: MAX,
    usagePercent: usagePct,
    warning: usagePct >= 50,
    details: counts,
  });
}
