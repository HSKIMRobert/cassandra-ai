/**
 * Export 회원 등록 / 목록 API
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
    try {
        const { email, name, organization, inviter } = await req.json();
        if (!email) return NextResponse.json({ error: "이메일이 필요합니다" }, { status: 400 });

        await prisma.appUser.upsert({
            where: { email },
            update: { name: name || email.split("@")[0], tier: "expert", expertCategory: "media" },
            create: {
                email, passwordHash: "",
                name: name || email.split("@")[0],
                role: "user", tier: "expert",
                expertCategory: "media",
                expertVerifiedAt: new Date(),
            },
        });

        // 레퍼럴 기록
        if (inviter) {
            await prisma.referral.create({
                data: { refCode: inviter, visitorIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown" },
            });
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const authDeny = await requireAdmin();
    if (authDeny) return authDeny;
    try {

        const exportUsers = await prisma.appUser.findMany({
            where: { tier: "expert", expertCategory: "media" },
            select: { email: true, name: true, lastLoginAt: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        // 각 유저의 초대 수
        const invites = await prisma.referral.groupBy({
            by: ["refCode"],
            _count: { refCode: true },
        });

        return NextResponse.json({
            users: exportUsers.map(u => ({
                email: u.email, name: u.name,
                createdAt: u.createdAt.toISOString(),
                lastLogin: u.lastLoginAt?.toISOString() || null,
                inviteCount: invites.find(i => i.refCode === u.email.split("@")[0]?.toUpperCase())?._count?.refCode || 0,
            })),
        });
    } catch {
        return NextResponse.json({ users: [] });
    }
}
