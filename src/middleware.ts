/**
 * Supabase SSR 미들웨어
 * 공개 경로 외 모든 페이지 → Supabase 세션 확인
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const EXPERT_PATHS = ["/", "/board", "/wiki", "/person-search", "/corp", "/person", "/fund", "/search", "/report"];
const EXPERT_EMAILS = ["gameworker@gmail.com", "c.sunho@gmail.com", "testcode@naver.com"];
const PUBLIC_PATHS = ["/saju", "/login", "/signup", "/admin", "/access-denied", "/expert-apply"];
const API_PREFIXES = ["/api/", "/_next", "/favicon", "/images"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 공개 경로 + API → 통과
  if (PUBLIC_PATHS.includes(path) || API_PREFIXES.some(p => path.startsWith(p))) {
    const res = NextResponse.next();
    if (SUPABASE_URL && SUPABASE_KEY) {
      const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value }) => res.cookies.set(name, value)) } });
      await supabase.auth.getSession();
    }
    return res;
  }

  // Supabase 미설정 → 기존 JWT 방식으로 fallback
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const token = request.cookies.get("auth-token")?.value;
    if (token) {
      if (path === "/login") return NextResponse.redirect(new URL("/dashboard", request.url));
      return NextResponse.next();
    }
    if (path !== "/login") return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.next();
  }

  // Supabase 세션 확인
  const res = NextResponse.next();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value }) => res.cookies.set(name, value)) } });
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    if (path === "/login") return NextResponse.redirect(new URL("/dashboard", request.url));
    // Expert 권한 체크
    if (EXPERT_PATHS.some(p => path === p || path.startsWith(p + "/"))) {
      const email = session.user?.email;
      if (email && !EXPERT_EMAILS.includes(email)) {
        return NextResponse.redirect(new URL("/access-denied?page=" + encodeURIComponent(path), request.url));
      }
    }
    return res;
  }

  // 비로그인 → /login
  if (path !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return res;
}

export const config = { matcher: ["/:path*"] };
