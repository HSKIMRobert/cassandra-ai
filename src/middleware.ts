/**
 * Supabase SSR 미들웨어
 * 공개 경로 외 모든 페이지 → Supabase 세션 확인
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/quant", "/dashboard", "/saju", "/login", "/signup"];
const API_PREFIXES = ["/api/", "/_next", "/favicon", "/images"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 공개 경로 + API → 통과
  if (PUBLIC_PATHS.includes(path) || API_PREFIXES.some(p => path.startsWith(p))) {
    const res = NextResponse.next();
    // 세션 갱신만 수행
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value }) => res.cookies.set(name, value)) } }
    );
    await supabase.auth.getSession();
    return res;
  }

  // Supabase 세션 확인
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value }) => res.cookies.set(name, value)) } }
  );

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    if (path === "/login") return NextResponse.redirect(new URL("/dashboard", request.url));
    return res;
  }

  // 비로그인 → /login
  if (path !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return res;
}

export const config = { matcher: ["/:path*"] };
