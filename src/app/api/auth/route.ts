/**
 * Supabase Auth API — 로그인·회원가입·Expert 신청
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Supabase Admin (패키지 없으면 null)
async function getSupabaseAdmin() {
    try {
        const mod = await Function('return import("@supabase/supabase-js")')() as any;
        return mod.createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    } catch {
        return null;
    }
}

// ─── 회원가입 (Supabase) ───
export async function POST(req: NextRequest) {
  const { action, email, password, nickname, companyEmail, companyName, reason, referrer } = await req.json();

  if (action === "signup") {
    try {
      const supabaseAdmin = await getSupabaseAdmin();
      if (!supabaseAdmin) {
        return NextResponse.json({ error: "Supabase가 설정되지 않았습니다. scripts/setup-supabase.sh 를 실행하세요." }, { status: 500 });
      }
      
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // 이메일 인증 스킵 (개발 중)
        user_metadata: { nickname: nickname || email.split("@")[0], tier: "normal" },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // 레퍼럴 코드가 있으면 저장
      if (referrer) {
        await supabaseAdmin.from("profiles").update({ referred_by: referrer }).eq("id", data.user.id);
        await supabaseAdmin.from("referral_codes").update({ used_count: supabaseAdmin.raw }, { code: referrer });
      }

      return NextResponse.json({ ok: true, userId: data.user.id });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "회원가입 실패" }, { status: 500 });
    }
  }

  if (action === "login") {
    // 기존 JWT 로그인 유지 (호환성)
    return NextResponse.json({ error: "Use POST /api/auth/login for login" }, { status: 400 });
  }

  // ─── Expert 신청 ───
  if (action === "expert-apply") {
    try {
      // 기존 JWT 세션에서 사용자 확인
      const token = req.cookies.get("auth-token")?.value;
      if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

      // 토큰 검증
      const { verifyToken } = await import("@/lib/auth");
      const payload = verifyToken(token);
      if (!payload || !(payload as any).userId) return NextResponse.json({ error: "유효하지 않은 토큰" }, { status: 401 });

      // 회사 이메일 도메인 검증
      const freeDomains = ["gmail.com", "naver.com", "daum.net", "kakao.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];
      const domain = companyEmail.split("@")[1]?.toLowerCase();
      if (!domain || freeDomains.includes(domain)) {
        return NextResponse.json({ error: "회사 이메일(@회사명.com)만 가능합니다. 무료 이메일은 사용할 수 없습니다." }, { status: 400 });
      }

      // Expert 신청 저장
      await prisma.$queryRawUnsafe(`
        INSERT INTO "ExpertApplication" (id, user_id, company_email, company_name, reason, status)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, 'pending')
      `, (payload as any).userId, companyEmail, companyName || "", reason || "");

      return NextResponse.json({ ok: true, message: "Expert 신청이 접수되었습니다. 관리자 승인까지 1-2일 소요됩니다." });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "신청 실패" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}

// ─── Supabase 연결 상태 확인 ───
export async function GET() {
  try {
    const supabaseAdmin = await getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ status: "not_configured" });
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
    if (error) return NextResponse.json({ status: "supabase_connected", userCount: 0 });
    return NextResponse.json({ status: "supabase_connected", userCount: users.length });
  } catch {
    return NextResponse.json({ status: "disconnected" });
  }
}
