/**
 * 사주 API — Redis 캐싱 적용
 * - 사주 결과: key=saju:{birthDate}:{hour}:{today} (하루 단위)
 * - 종목 궁합: key=saju:stock:{code}:{userElement}
 */
import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis-cache";
import { prisma } from "@/lib/prisma";
import { buildProfile, todayFor, summaryLines, FORTUNE_KEYS, FORTUNE_KR, getPersonality, monthlyFortune, yearlyFortune } from "@/lib/saju-engine";

export async function POST(req: NextRequest) {
    try {
        const { birthDate, birthHour, gender, nickname, stockQuery, userElement } = await req.json();

        // ─── 종목 궁합 검색 (캐시 키: saju:stock:CODE:ELEMENT) ───
        if (stockQuery && userElement) {
            const code = stockQuery.toUpperCase().trim();
            const cacheKey = `saju:stock:${code}:${userElement}`;
            const cached = await getCache(cacheKey);
            if (cached && !cached.stale) return NextResponse.json({ ...cached.data, fromCache: true });

            // 종목 분석은 여기서 직접 처리하지 않고 클라이언트에서 함
            // 캐시만 반환 가능하도록 함
            return NextResponse.json({ fromCache: false, stock: code, element: userElement });
        }

        // ─── 사주 분석 ───
        if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
            return NextResponse.json({ error: "생년월일을 YYYY-MM-DD 형식으로 입력해주세요." }, { status: 400 });
        }

        const hour = birthHour != null ? Number(birthHour) : null;
        if (hour !== null && (hour < 0 || hour > 23)) {
            return NextResponse.json({ error: "태어난 시간은 0-23 사이로 입력해주세요." }, { status: 400 });
        }

        // 캐시 키: saju:birthDate:hour:todayDate
        const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const cacheKey = `saju:${birthDate}:${hour ?? "null"}:${todayStr}`;
        const cached = await getCache(cacheKey);
        if (cached && !cached.stale) {
            return NextResponse.json({ ...cached.data, fromCache: true });
        }

        const profile = buildProfile(birthDate, hour);
        const today = todayFor(profile);
        const summary = summaryLines(profile, today);
        const personality = getPersonality(profile.iljuLabel);
        const monthly = monthlyFortune(profile);
        const yearly = yearlyFortune(profile, nickname);

        // 활동 로그 기록 (비동기)
        logSaju(nickname, birthDate, req).catch(() => {});

        const result = {
            profile: {
                birthDate: profile.birthDate,
                birthHour: profile.birthHour,
                ilju: profile.iljuLabel,
                element: profile.myElement,
                elementKr: ({
                    wood:"목(木)",fire:"화(火)",earth:"토(土)",metal:"금(金)",water:"수(水)"
                } as Record<string,string>)[profile.myElement],
                polarity: profile.polarity === "yang" ? "양" : "음",
                dayBranch: profile.branchKr,
            },
            today: {
                date: today.date,
                ilju: today.iljuLabel,
                relation: today.relationLabel,
            },
            fortune: Object.fromEntries(
                FORTUNE_KEYS.map(k => [FORTUNE_KR[k], today.fortune[k]])
            ),
            summary,
            nickname: nickname || "",
            fromCache: false,
            personality,
            monthly,
            yearly,
        };

        // Redis 저장 (24시간 TTL)
        await setCache(cacheKey, result);
        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: "사주 계산 중 오류가 발생했습니다." }, { status: 500 });
    }
}

// ─── 활동 로깅 ───
async function logSaju(nickname: string | undefined, birthDate: string | undefined, req: NextRequest) {
    if (!nickname || !birthDate) return;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    // 오늘 이미 같은 닉네임+생일로 기록했으면 스킵 (중복 방지)
    const kst = new Date(Date.now() + 9*60*60*1000); const today = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9*60*60*1000);
    const existing = await prisma.sajuLog.findFirst({
        where: { nickname, birthDate, action: "saju_submit", createdAt: { gte: today } },
    });
    if (!existing) {
        await prisma.sajuLog.create({
            data: { nickname, birthDate, action: "saju_submit", ip },
        });
    }
}

export async function PUT(req: NextRequest) {
    // 종목 질문 로깅
    try {
        const { nickname, birthDate, stock } = await req.json();
        if (!nickname || !birthDate || !stock) {
            return NextResponse.json({ error: "필수값 누락" }, { status: 400 });
        }
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
        await prisma.sajuLog.create({
            data: { nickname, birthDate, action: "stock_query", stock: String(stock).toUpperCase(), ip },
        });
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ ok: false });
    }
}
