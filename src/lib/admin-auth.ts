import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

/**
 * 서버사이드 관리자 인증.
 * 인증 실패 시 NextResponse(401/403)를 반환하고, 성공 시 null 반환.
 *
 * 사용법:
 *   const deny = await requireAdmin();
 *   if (deny) return deny;
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ error: "Supabase 설정 없음" }, { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  if (!ADMIN_EMAILS.includes(user.email ?? "")) {
    return NextResponse.json({ error: "관리자 권한 없음" }, { status: 403 });
  }

  return null;
}
