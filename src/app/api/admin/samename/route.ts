import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const unresolved = searchParams.get("unresolved") === "1";
  const skip = (page - 1) * PAGE_SIZE;

  const where = unresolved ? { resolved: false } : {};

  const [groups, total] = await Promise.all([
    prisma.sameNameGroup.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.sameNameGroup.count({ where }),
  ]);

  // personIds 배열로 Person 상세 조회
  const allUids = groups.flatMap((g) => g.personIds);
  const persons = await prisma.person.findMany({
    where: { personUid: { in: allUids }, deletedAt: null },
    select: {
      id: true,
      personUid: true,
      name: true,
      birthDate: true,
      bio: true,
      flags: true,
      _count: { select: { corpRelations: true } },
    },
  });
  const personMap = Object.fromEntries(persons.map((p) => [p.personUid, p]));

  const result = groups.map((g) => ({
    ...g,
    persons: g.personIds.map((uid) => personMap[uid] ?? null).filter(Boolean),
  }));

  return NextResponse.json({ groups: result, total, page, pageSize: PAGE_SIZE });
}
