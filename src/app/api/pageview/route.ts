/**
 * 페이지뷰 API — Redis 캐시 + Prisma(Neon DB) + 경로별 필터링
 */
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";

let redis: Redis | null = null;
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
if (URL && TOKEN) redis = new Redis({ url: URL, token: TOKEN });

const memCache = new Map<string, { v: number; ts: number }>();
const MEM_TTL = 5 * 60 * 1000;

function todayKST() {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 0, 0, 0, 0) - 9 * 60 * 60 * 1000);
}

async function getRedis(key: string): Promise<number | null> {
    if (redis) try { return await redis.get<number>(key); } catch { return null; }
    const m = memCache.get(key);
    if (m && Date.now() - m.ts < MEM_TTL) return m.v;
    return null;
}
async function setRedis(key: string, v: number, ttlSec = 600) {
    if (redis) try { await redis.set(key, v, { ex: ttlSec }); } catch {}
    memCache.set(key, { v, ts: Date.now() });
}

export async function GET(req: NextRequest) {
    try {
        const today = todayKST();
        const path = req.nextUrl.searchParams.get("path") || "";
        const pathFilter = path ? { path: { startsWith: path } } : {};

        // Redis 키: 경로별 분리
        const cacheToday = await getRedis(`pv:today:${path}`);
        const cacheTotal = await getRedis(`pv:total:${path}`);

        let todayCount: number;
        let totalCount: number;

        if (cacheToday !== null && cacheTotal !== null) {
            todayCount = cacheToday;
            totalCount = cacheTotal;
        } else {
            todayCount = await prisma.pageView.count({
                where: { ...pathFilter, createdAt: { gte: today } },
            });
            totalCount = await prisma.pageView.count({ where: pathFilter });
            await setRedis(`pv:today:${path}`, todayCount);
            await setRedis(`pv:total:${path}`, totalCount);
        }

        return NextResponse.json({ today: todayCount, total: totalCount });
    } catch {
        return NextResponse.json({ today: 0, total: 0 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { path, userId } = await req.json().catch(() => ({}));
        const pagePath = path || "/";

        await prisma.pageView.create({
            data: {
                path: pagePath,
                ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
                userId: userId || undefined,
            },
        });

        // 경로별 + 전체 캐시 무효화
        if (redis) try {
            await redis.del(`pv:today:${pagePath}`, `pv:total:${pagePath}`, "pv:today:", "pv:total:");
        } catch {}
        for (const k of memCache.keys()) memCache.delete(k);

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false });
    }
}
