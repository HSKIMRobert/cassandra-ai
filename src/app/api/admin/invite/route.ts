import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

const INVITE_DAYS = 7;

const SUPA_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function supabaseAdminFetch(path: string, method: string, body?: object) {
  const key = SUPA_KEY();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수 없음");

  const res = await fetch(`${SUPA_URL()}/auth/v1/admin/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok) {
    // Supabase Admin API 에러를 명시적으로 throw
    throw new Error(json?.message || json?.msg || json?.error_description || `HTTP ${res.status}`);
  }
  return json;
}

// POST: 초대 이메일 등록 (7일 만료)
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth) return auth;
  const { email } = await req.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "유효한 이메일이 필요합니다" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.expertInvite.upsert({
    where: { email },
    update: { createdBy: "admin", createdAt: new Date(), expiresAt, acceptedAt: null },
    create: { email, createdBy: "admin", expiresAt },
  });

  const link = `https://dart-monitor-pi.vercel.app/invite?email=${encodeURIComponent(email)}`;
  return NextResponse.json({ ok: true, link, expiresAt: expiresAt.toISOString() });
}

// GET: 초대 검증 (invite 페이지에서 호출) 또는 초대 목록 (admin)
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const list  = req.nextUrl.searchParams.get("list");

  if (list === "1") {
    const authDeny = await requireAdmin();
    if (authDeny) return authDeny;
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
  const { email, password, name, phone } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "이메일/비밀번호 필요" }, { status: 400 });

  // SUPABASE_SERVICE_ROLE_KEY 사전 체크
  if (!SUPA_KEY()) {
    return NextResponse.json(
      { error: "서버 설정 오류: SUPABASE_SERVICE_ROLE_KEY 없음. 관리자에게 문의하세요." },
      { status: 500 }
    );
  }

  // 초대 재검증
  const invite = await prisma.expertInvite.findUnique({ where: { email } });
  if (!invite) return NextResponse.json({ error: "초대 없음" }, { status: 403 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "초대 만료" }, { status: 403 });

  try {
    // Admin REST API로 유저 생성 (email_confirm: true → 이메일 인증 불필요)
    await supabaseAdminFetch("users", "POST", {
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split("@")[0], role: "expert" },
      app_metadata: { role: "expert" },
    });
  } catch (err: any) {
    const msg = err.message ?? "";

    // 이미 존재하는 유저면 비밀번호 + role 업데이트
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("email address")) {
      try {
        const list = await supabaseAdminFetch(`users?email=${encodeURIComponent(email)}`, "GET");
        const existing = list?.users?.[0];
        if (existing?.id) {
          await supabaseAdminFetch(`users/${existing.id}`, "PUT", {
            password,
            email_confirm: true,
            user_metadata: { name: name || existing.user_metadata?.name || email.split("@")[0], role: "expert" },
            app_metadata: { role: "expert" },
          });
        }
      } catch (updateErr: any) {
        return NextResponse.json({ error: `기존 유저 업데이트 실패: ${updateErr.message}` }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: `유저 생성 실패: ${msg}` }, { status: 500 });
    }
  }

  // 초대 완료 처리
  await prisma.expertInvite.update({
    where: { email },
    data: { acceptedAt: new Date(), name: name || null, phone: phone || null },
  });

  // AppUser 기록
  await prisma.appUser.upsert({
    where: { email },
    update: { tier: "expert", name: name || email.split("@")[0], phone: phone || null },
    create: { email, passwordHash: "", name: name || email.split("@")[0], phone: phone || null, role: "user", tier: "expert" },
  });

  return NextResponse.json({ ok: true });
}
