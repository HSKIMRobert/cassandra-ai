/**
 * Expert 인증 API
 * POST /api/auth/expert — Expert 신청·재인증·상태확인
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isExpertDomain, getDomainCategory, checkExpertStatus, sendExpertReverifyOtp, completeReverify } from "@/lib/expert";

export async function POST(req: NextRequest) {
    const { action, email } = await req.json();

    // ─── 도메인 검증 ───
    if (action === "verify-domain") {
        if (!email) return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });
        const domain = email.split("@")[1];
        const allowed = isExpertDomain(email);
        const category = getDomainCategory(email);
        return NextResponse.json({
            allowed,
            category,
            domain,
            message: allowed
                ? `${category === "media" ? "언론사" : "공공기관"} 이메일로 확인되었습니다.`
                : "허용된 기관 이메일이 아닙니다. 언론사·공공기관 이메일만 가능합니다.",
        });
    }

    // ─── Expert 등록 ───
    if (action === "register") {
        if (!email) return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });
        if (!isExpertDomain(email)) {
            return NextResponse.json({ error: "허용된 기관 이메일이 아닙니다." }, { status: 400 });
        }

        const category = getDomainCategory(email);

        // DB 사용자 업데이트 또는 생성
        await prisma.appUser.upsert({
            where: { email },
            update: { tier: "expert", expertCategory: category, expertVerifiedAt: new Date() },
            create: {
                email,
                passwordHash: "", // Supabase가 인증 처리
                name: email.split("@")[0],
                role: "user",
                tier: "expert",
                expertCategory: category,
                expertVerifiedAt: new Date(),
            },
        });

        return NextResponse.json({
            ok: true,
            category,
            message: `${category === "media" ? "언론사" : "공공기관"} Expert로 등록되었습니다. 6개월마다 재인증이 필요합니다.`,
        });
    }

    // ─── 상태 확인 ───
    if (action === "status") {
        if (!email) return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });
        const status = await checkExpertStatus(email);
        return NextResponse.json(status);
    }

    // ─── 재인증 OTP 발송 ───
    if (action === "reverify-send") {
        if (!email) return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });
        const result = await sendExpertReverifyOtp(email);
        return NextResponse.json(result);
    }

    // ─── 재인증 완료 ───
    if (action === "reverify-complete") {
        if (!email) return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });
        await completeReverify(email);
        return NextResponse.json({ ok: true, message: "재인증이 완료되었습니다. 6개월간 유효합니다." });
    }

    return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}
