/**
 * 페이지뷰 API — Redis 캐시 + Prisma(Neon DB) 영구 저장
 * - GET: Redis 우선 조회 → 없으면 DB → Redis 적재 (TTL 10분)
 * - POST: DB 저장 + Redis 카운터 증가
 */
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";

// Upstash Redis
let redis: Redis | null = null;
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
if (URL && TOKEN) redis = new Redis({ url: URL, token: TOKEN });

// 인메모리 폴백
const memCache = new Map<string, { v: number; ts: number }>();
const MEM_TTL = 5 * 60 * 1000; // 5분

function todayUTC() { return new Date(new Date().setHours(0, 0, 0, 0)); }

async function getRedis(key: string): Promise<number | null> {
    if (redis) try { return await redis.get<number>(key); } catch { return null; }
    const m = memCache.get(key);
    if (m && Date.now() - m.ts < MEM_TTL) return m.v;
    return null;
}
async function setRedis(key: string, v: number, ttlSec = 600) {
    if (redis) try {
        await redis.set(key, v, { ex: ttlSec });
    } catch {}
    memCache.set(key, { v, ts: Date.now() });
}

export async function GET() {
    try {
        const today = todayUTC();
        const cacheToday = await getRedis("pv:today");
        const cacheTotal = await getRedis("pv:total");

        let todayCount: number;
        let totalCount: number;

        if (cacheToday !== null && cacheTotal !== null) {
            todayCount = cacheToday;
            totalCount = cacheTotal;
        } else {
            // DB에서 조회
            todayCount = await prisma.pageView.count({
                where: { createdAt: { gte: today } },
            });
            totalCount = await prisma.pageView.count();

            // Redis 적재 (10분 TTL)
            await setRedis("pv:today", todayCount);
            await setRedis("pv:total", totalCount);
        }

        return NextResponse.json({ today: todayCount, total: totalCount });
    } catch {
        return NextResponse.json({ today: 0, total: 0 });
    }
}

// 페이지뷰 기록
export async function POST(req: NextRequest) {
    try {
        const { path, userId } = await req.json().catch(() => ({}));

        // DB 저장
        await prisma.pageView.create({
            data: {
                path: path || "/",
                ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
                userId: userId || undefined,
            },
        });

        // Redis 무효화 (다음 GET에서 DB 재조회)
        if (redis) try {
            await redis.del("pv:today", "pv:total");
        } catch {}
        memCache.delete("pv:today");
        memCache.delete("pv:total");

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false });
    }
}
