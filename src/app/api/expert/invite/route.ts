/**
 * Expert가 다른 사람을 초대하는 API
 * POST: 초대 이메일 등록 (invitedByEmail = 현재 expert)
 * GET:  내가 초대한 목록 조회
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const INVITE_DAYS = 7;

async function getExpertSession(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getExpertSession(req);
  if (!user?.email) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  // expert 또는 admin만 초대 가능
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;
  const ADMIN_EMAILS = ["gameworker@gmail.com"];
  if (metaRole !== "expert" && !ADMIN_EMAILS.includes(user.email)) {
    return NextResponse.json({ error: "Expert 회원만 초대할 수 있습니다" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "유효한 이메일을 입력하세요" }, { status: 400 });
  }
  if (email.toLowerCase() === user.email.toLowerCase()) {
    return NextResponse.json({ error: "자기 자신은 초대할 수 없습니다" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.expertInvite.upsert({
    where: { email },
    update: {
      createdBy: `expert:${user.email}`,
      invitedByEmail: user.email,
      createdAt: new Date(),
      expiresAt,
      acceptedAt: null,
    },
    create: {
      email,
      createdBy: `expert:${user.email}`,
      invitedByEmail: user.email,
      expiresAt,
    },
  });

  const link = `https://dart-monitor-pi.vercel.app/invite?email=${encodeURIComponent(email)}`;
  return NextResponse.json({ ok: true, link, expiresAt: expiresAt.toISOString() });
}

export async function GET(req: NextRequest) {
  const user = await getExpertSession(req);
  if (!user?.email) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

  const invites = await prisma.expertInvite.findMany({
    where: { invitedByEmail: user.email },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ invites });
}
