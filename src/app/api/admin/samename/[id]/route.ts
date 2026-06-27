import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/redis-cache";
import { requireAdmin } from "@/lib/admin-auth";

async function getAdminEmail(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? "admin";
}

// GET /api/admin/samename/[id] — 상세 (각 Person의 회사 관계 포함)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;

  const group = await prisma.sameNameGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "그룹 없음" }, { status: 404 });

  const persons = await prisma.person.findMany({
    where: { personUid: { in: group.personIds }, deletedAt: null },
    select: {
      id: true,
      personUid: true,
      name: true,
      birthDate: true,
      bio: true,
      flags: true,
      createdAt: true,
      corpRelations: {
        select: {
          role: true,
          isCurrent: true,
          since: true,
          until: true,
          corp: { select: { companyName: true, corpCode: true, market: true } },
        },
        orderBy: { since: "desc" },
        take: 20,
      },
    },
  });

  return NextResponse.json({ group, persons });
}

// POST /api/admin/samename/[id] — merge / split / pending 액션
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin();
  if (deny) return deny;

  const { id } = await params;
  const body = await req.json();
  const { action, primaryPersonId } = body as {
    action: "merge" | "split" | "pending";
    primaryPersonId?: string;
  };

  // resolvedBy는 서버 세션에서 추출 (body 파라미터 무시)
  const resolvedBy = await getAdminEmail();

  const group = await prisma.sameNameGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "그룹 없음" }, { status: 404 });

  if (action === "merge") {
    if (!primaryPersonId) return NextResponse.json({ error: "primaryPersonId 필요" }, { status: 400 });

    // primaryPersonId 제외한 나머지를 병합
    const secondary = group.personIds.filter((uid) => uid !== primaryPersonId);
    const secondaryPersons = await prisma.person.findMany({
      where: { personUid: { in: secondary } },
      select: { id: true, personUid: true },
    });

    const primaryPerson = await prisma.person.findUnique({
      where: { personUid: primaryPersonId },
      select: { id: true },
    });
    if (!primaryPerson) return NextResponse.json({ error: "기준 Person 없음" }, { status: 404 });

    // 관계 이전 + soft-delete (트랜잭션)
    await prisma.$transaction(async (tx) => {
      for (const sp of secondaryPersons) {
        await tx.corpPersonRelation.updateMany({
          where: { personId: sp.id },
          data: { personId: primaryPerson.id },
        });
        await tx.person.update({
          where: { id: sp.id },
          data: { deletedAt: new Date(), mergedInto: primaryPerson.id },
        });
      }
      await tx.sameNameGroup.update({
        where: { id },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy,
          verdict: "SAME",
        },
      });
    });

    // 그래프 캐시 무효화 — 이름 기반 키 삭제 시도
    try {
      const name = group.name;
      await setCache(`graph:${name}:2`, null, 1);
      await setCache(`graph:${name}:3`, null, 1);
    } catch {}

    return NextResponse.json({ ok: true, action: "merge", merged: secondaryPersons.length });
  }

  if (action === "split") {
    await prisma.sameNameGroup.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        verdict: "DIFFERENT",
      },
    });
    return NextResponse.json({ ok: true, action: "split" });
  }

  if (action === "pending") {
    await prisma.sameNameGroup.update({
      where: { id },
      data: { resolved: false, verdict: "PENDING", resolvedBy },
    });
    return NextResponse.json({ ok: true, action: "pending" });
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}
