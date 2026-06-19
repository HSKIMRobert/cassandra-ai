import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function extractEntityName(raw: string): string {
  return raw
    .replace(/\s*(분석해줘|분석해|분석요청|알려줘|조사해줘|이사진|주주|관계자|정보)\s*/g, " ")
    .replace(/\s*(을|를|의|에|과|와|이|가|은|는)\s*/g, " ")
    .trim()
    .split(/\s+/)[0]?.trim() || raw.trim();
}

export async function POST() {
  // 완료된 BatchJob 목록
  const doneJobs = await prisma.batchJob.findMany({
    where: { status: "DONE", reportPath: { not: null } },
    select: { targetName: true, result: true, reportPath: true },
  });

  let updated = 0;

  for (const job of doneJobs) {
    const searchName = extractEntityName(job.targetName);

    const posts = await prisma.boardPost.findMany({
      where: {
        category: "ANALYSIS_REQUEST",
        status: { in: ["PENDING", "PROCESSING"] },
        OR: [
          { targetCorp: { contains: searchName, mode: "insensitive" } },
          { targetPerson: { contains: searchName, mode: "insensitive" } },
          { targetCorp: { contains: job.targetName, mode: "insensitive" } },
          { targetPerson: { contains: job.targetName, mode: "insensitive" } },
        ],
      },
    });

    for (const post of posts) {
      await prisma.boardPost.update({
        where: { id: post.id },
        data: { status: "RESOLVED", analysis: job.result, reportPath: job.reportPath },
      });
      updated++;
    }
  }

  return NextResponse.json({ updated, jobCount: doneJobs.length });
}
