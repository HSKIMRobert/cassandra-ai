/**
 * Supabase SSR 미들웨어 — 기존 JWT + Supabase 세션 병행
 * 
 * 우선순위: 
 * 1. 기존 auth-token 쿠키 → JWT 인증 (현행)
 * 2. Supabase 세션 → 마이그레이션 완료 후 활성화
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 서버에서 Supabase 사용 시 주석 해제
// import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/quant", "/dashboard", "/saju", "/login", "/expert-apply"];
const API_PREFIXES = ["/api/", "/_next", "/favicon", "/images"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // 공개 경로 + API → 통과
  if (PUBLIC_PATHS.includes(path) || API_PREFIXES.some(p => path.startsWith(p))) {
    return NextResponse.next();
  }

  // ─── 기존 JWT 방식 (현행) ───
  const token = request.cookies.get("auth-token")?.value;
  if (token) {
    if (path === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // ─── Supabase 세션 방식 (마이그레이션 후) ───
  // const supabase = createServerClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } }
  // );
  // const { data: { session } } = await supabase.auth.getSession();
  // if (session) {
  //   if (path === "/login") return NextResponse.redirect(new URL("/dashboard", request.url));
  //   return NextResponse.next();
  // }

  // 비로그인 → /login 리다이렉트
  if (path !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
