/**
 * Supabase Auth 콜백 — OAuth 로그인 완료 후 세션 교환 + 로그 기록
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", req.url));
  }

  const res = NextResponse.redirect(new URL(next, req.url));
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options)) } }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, req.url));
  }

  // 로그인 기록 저장 (비동기)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  recordLogin(supabase, ip).catch(() => {});

  return res;
}

async function recordLogin(supabase: any, ip?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.email) return;

    const email = session.user.email;

    // LoginHistory 기록
    await prisma.loginHistory.create({
      data: {
        userId: email,
        email,
        success: true,
        ip,
        userAgent: "Supabase Google OAuth",
      },
    });

    // AppUser upsert
    await prisma.appUser.upsert({
      where: { email },
      update: { lastLoginAt: new Date() },
      create: {
        email,
        passwordHash: "",
        name: email.split("@")[0],
        role: "user",
        tier: "normal",
      },
    });
  } catch {}
}
