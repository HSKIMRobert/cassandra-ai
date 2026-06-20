import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["gameworker@gmail.com"];
const INVITE_DAYS = 7;

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

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

  if (list === "1") {
    const invites = await prisma.expertInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ invites });
  }

  if (!email) return NextResponse.json({ approved: false, reason: "no_email" });

  const invite = await prisma.expertInvite.findUnique({ where: { email } });
  if (!invite) return NextResponse.json({ approved: false, reason: "not_invited" });
  if (invite.expiresAt < new Date()) return NextResponse.json({ approved: false, reason: "expired" });
  if (invite.acceptedAt) return NextResponse.json({ approved: false, reason: "already_used" });

  return NextResponse.json({ approved: true });
}

// PATCH: 서버에서 Supabase Admin으로 유저 생성 + 이메일 인증 자동 완료
export async function PATCH(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "이메일/비밀번호 필요" }, { status: 400 });

  // 초대 재검증
  const invite = await prisma.expertInvite.findUnique({ where: { email } });
  if (!invite) return NextResponse.json({ error: "초대 없음" }, { status: 403 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "초대 만료" }, { status: 403 });

  const supabase = adminSupabase();

  // Admin API로 유저 생성 (email_confirm: true → 이메일 인증 불필요)
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || email.split("@")[0], role: "expert" },
  });

  // 이미 존재하는 유저면 비밀번호 + metadata 업데이트
  if (createErr?.message?.toLowerCase().includes("already")) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users?.find((u: any) => u.email === email);
    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { name: name || existing.user_metadata?.name || email.split("@")[0], role: "expert" },
      });
    }
  } else if (createErr) {
    return NextResponse.json({ error: createErr.message }, { status: 500 });
  }

  // 초대 완료 처리
  await prisma.expertInvite.update({
    where: { email },
    data: { acceptedAt: new Date(), name: name || null },
  });

  // AppUser 기록
  await prisma.appUser.upsert({
    where: { email },
    update: { tier: "expert", name: name || email.split("@")[0] },
    create: { email, passwordHash: "", name: name || email.split("@")[0], role: "user", tier: "expert" },
  });

  return NextResponse.json({ ok: true });
}
