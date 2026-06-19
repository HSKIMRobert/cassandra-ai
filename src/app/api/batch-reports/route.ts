import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.batchJob.findMany({
    where: { status: "DONE", reportPath: { not: null } },
    orderBy: { processedAt: "desc" },
    take: 50,
    select: {
      id: true,
      targetName: true,
      targetType: true,
      reportPath: true,
      processedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(jobs);
}
