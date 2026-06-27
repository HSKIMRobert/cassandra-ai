import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth) return auth;
  try {
    // Supabase Admin REST API로 전체 유저 목록 조회
    const res = await fetch(`${SUPA_URL}/auth/v1/admin/users?page=1&per_page=200`, {
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
      },
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.msg || err.message || "Supabase 오류" }, { status: res.status });
    }

    const data = await res.json();
    const users = (data.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name || u.user_metadata?.full_name || "-",
      provider: u.app_metadata?.provider || "email",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
      emailConfirmed: !!u.email_confirmed_at,
      loginCount: 0, // audit_log는 별도 API 필요, 일단 0
    }));

    return NextResponse.json({ users });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
