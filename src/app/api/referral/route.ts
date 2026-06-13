/**
 * 레퍼럴 API — 추천인 통계 + 기록
 * POST: 레퍼럴 방문 기록
 * GET: 레퍼럴 통계 (일간/누적)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const { refCode } = await req.json();
        if (!refCode || typeof refCode !== "string") {
            return NextResponse.json({ ok: false, error: "refCode required" });
        }
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

        // 중복 방지: 같은 IP + refCode + 오늘 = 1회만
        const kst = new Date(Date.now() + 9*60*60*1000); const today = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9*60*60*1000);
        const existing = await prisma.referral.findFirst({
            where: { refCode, visitorIp: ip, createdAt: { gte: today } },
        });
        if (existing) return NextResponse.json({ ok: true, duplicate: true });

        await prisma.referral.create({ data: { refCode, visitorIp: ip } });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false });
    }
}

export async function GET(req: NextRequest) {
    try {
        const refCode = req.nextUrl.searchParams.get("refCode");
        const kst = new Date(Date.now() + 9*60*60*1000); const today = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9*60*60*1000);

        if (refCode) {
            // 특정 추천인 통계
            const [total, daily] = await Promise.all([
                prisma.referral.count({ where: { refCode } }),
                prisma.referral.count({ where: { refCode, createdAt: { gte: today } } }),
            ]);
            return NextResponse.json({ refCode, total, daily });
        }

        // 전체 레퍼럴 순위 (상위 10)
        const rankings = await prisma.referral.groupBy({
            by: ["refCode"],
            _count: { refCode: true },
            orderBy: { _count: { refCode: "desc" } },
            take: 10,
        });

        return NextResponse.json({
            rankings: rankings.map(r => ({ refCode: r.refCode, count: r._count.refCode })),
        });
    } catch {
        return NextResponse.json({ rankings: [] });
    }
}
