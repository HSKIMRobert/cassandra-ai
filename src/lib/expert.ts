/**
 * Expert 회원 인증 로직
 * - 언론·공공기관 이메일 도메인 검증
 * - 6개월 재인증
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// 언론사 도메인
const MEDIA_DOMAINS = [
    "jtbc.co.kr", "sbs.co.kr", "mbc.co.kr", "kbs.co.kr",
    "chosun.com", "joongang.co.kr", "donga.com", "hani.co.kr",
    "kmib.co.kr", "segye.com", "yna.co.kr", "newsis.com",
    "news1.kr", "newspim.com", "dt.co.kr", "etnews.com",
    "hankyung.com", "mk.co.kr", "sedaily.com", "edaily.co.kr",
    "fnnews.com", "mt.co.kr", "bizwatch.co.kr", "bloter.net",
];

// 공공기관 도메인
const GOV_DOMAINS = [
    "police.go.kr", "spo.go.kr", "korea.kr", "moj.go.kr",
    "mosf.go.kr", "assembly.go.kr", "court.go.kr", "nps.or.kr",
    "fss.or.kr", "kofia.or.kr", "krx.co.kr", "fsi.or.kr",
    "bok.or.kr", "kdi.re.kr", "nars.go.kr", "ftc.go.kr",
];

const ALL_ALLOWED = [...MEDIA_DOMAINS, ...GOV_DOMAINS];

export function isExpertDomain(email: string): boolean {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return false;
    // 정확히 일치하거나 하위 도메인 (예: press.kbs.co.kr)
    return ALL_ALLOWED.some(d => domain === d || domain.endsWith("." + d));
}

export function getDomainCategory(email: string): "media" | "gov" | null {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return null;
    if (MEDIA_DOMAINS.some(d => domain === d || domain.endsWith("." + d))) return "media";
    if (GOV_DOMAINS.some(d => domain === d || domain.endsWith("." + d))) return "gov";
    return null;
}

// 6개월(180일) 재인증 체크
const REVERIFY_DAYS = 180;

export async function checkExpertStatus(email: string): Promise<{
    isExpert: boolean;
    needsReverify: boolean;
    daysSinceVerified: number | null;
}> {
    const user = await prisma.appUser.findFirst({
        where: { email },
        select: { tier: true, expertVerifiedAt: true },
    });

    if (!user || (user.tier !== "expert" && user.tier !== "admin")) {
        return { isExpert: false, needsReverify: false, daysSinceVerified: null };
    }

    if (!user.expertVerifiedAt) {
        return { isExpert: true, needsReverify: true, daysSinceVerified: null };
    }

    const days = Math.floor((Date.now() - user.expertVerifiedAt.getTime()) / 86400000);
    return {
        isExpert: true,
        needsReverify: days >= REVERIFY_DAYS,
        daysSinceVerified: days,
    };
}

// Supabase OTP 재인증
export async function sendExpertReverifyOtp(email: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { cookies: { getAll: () => [], setAll: () => {} } }
        );

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false,
                data: { purpose: "expert-reverify" },
            },
        });

        if (error) return { ok: false, error: error.message };
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e.message };
    }
}

// 재인증 완료 처리
export async function completeReverify(email: string): Promise<void> {
    await prisma.appUser.updateMany({
        where: { email },
        data: { expertVerifiedAt: new Date() },
    });
}
