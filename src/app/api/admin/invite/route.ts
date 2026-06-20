import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = ["gameworker@gmail.com"];
const INVITE_DAYS = 7;

// POST: 초대 이메일 등록 (7일 만료)
export async function POST(req: NextRequest) {
  const { email, adminEmail } = await req.json();
  if (!adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
    return NextResponse.json({ error: "관리자 권한 필요" }, { status: 403 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "유효한 이메일이 필요합니다" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.expertInvite.upsert({
    where: { email },
    update: { createdBy: adminEmail, createdAt: new Date(), expiresAt, acceptedAt: null },
    create: { email, createdBy: adminEmail, expiresAt },
  });

  const link = `https://dart-monitor-pi.vercel.app/invite?email=${encodeURIComponent(email)}`;
  return NextResponse.json({ ok: true, link, expiresAt: expiresAt.toISOString() });
}

// GET: 초대 검증 (invite 페이지에서 호출) 또는 초대 목록 (admin)
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const list  = req.nextUrl.searchParams.get("list");

  // 초대 목록 조회
  if (list === "1") {
    const invites = await prisma.expertInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ invites });
  }

  // 단일 이메일 검증
  if (!email) return NextResponse.json({ approved: false, reason: "no_email" });

  const invite = await prisma.expertInvite.findUnique({ where: { email } });
  if (!invite) return NextResponse.json({ approved: false, reason: "not_invited" });
  if (invite.expiresAt < new Date()) return NextResponse.json({ approved: false, reason: "expired" });
  if (invite.acceptedAt) return NextResponse.json({ approved: false, reason: "already_used" });

  return NextResponse.json({ approved: true });
}

// PATCH: 가입 완료 처리
export async function PATCH(req: NextRequest) {
  const { email, name } = await req.json();
  if (!email) return NextResponse.json({ error: "이메일 필요" }, { status: 400 });

  await prisma.expertInvite.update({
    where: { email },
    data: { acceptedAt: new Date(), name: name || null },
  });

  // AppUser도 tier=expert로 등록/업데이트
  await prisma.appUser.upsert({
    where: { email },
    update: { tier: "expert" },
    create: { email, passwordHash: "", name: name || email.split("@")[0], role: "user", tier: "expert" },
  });

  return NextResponse.json({ ok: true });
}
