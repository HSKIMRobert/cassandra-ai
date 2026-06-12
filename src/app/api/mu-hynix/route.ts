/**
 * MU → 하이닉스 예측 API (Yahoo Finance + Redis 10분 캐시)
 * ?force=true → 강제 갱신
 */
import { NextRequest, NextResponse } from "next/server";
import { predictHynix } from "@/lib/mu-hynix-predict";
import { prisma } from "@/lib/prisma";
import { getCache, setCache } from "@/lib/redis-cache";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

export async function GET(req: NextRequest) {
    const force = req.nextUrl.searchParams.get("force") === "true";

    try {
        const prediction = await predictHynix();
        if (!prediction) {
            return NextResponse.json({ error: "Failed to fetch data" }, { status: 502 });
        }

        // DB 저장 (비동기, 실패해도 응답은 정상)
        savePrediction(prediction).catch(() => {});
        saveToGitHub(prediction).catch(() => {});

        // 14일 백테스트
        const backtest = await getBacktest(prediction, force);

        return NextResponse.json({ prediction, backtest });
    } catch {
        const cached = await getCache("mu-hynix");
        if (cached) return NextResponse.json({ prediction: cached.data, backtest: [] });
        return NextResponse.json({ error: "Failed" }, { status: 502 });
    }
}

async function savePrediction(p: any) {
    try {
        await prisma.muHynixPrediction.create({
            data: {
                muCurrentPrice: p.muCurrentPrice,
                muChangePct: p.muChangePct,
                hynixPrevClose: p.hynixPrevClose,
                hynixPredictedOpen: p.hynixPredictedOpen,
                hynixPredictedChangePct: p.hynixPredictedChangePct,
                beta: p.beta,
                r2: p.r2,
                dataPoints: p.dataPoints,
            },
        });
        // 90일 초과 데이터 정리
        await prisma.muHynixPrediction.deleteMany({
            where: { createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
        });
    } catch {}
}

// ─── 14일 백테스트 (예측 vs 실제) ───
async function getBacktest(current: any, force: boolean) {
    const cachedKey = "mu-hynix-backtest";
    if (!force) {
        const cached = await getCache(cachedKey);
        if (cached && !cached.stale) return cached.data;
    }

    try {
        // DB에서 최근 예측 조회
        const predictions = await prisma.muHynixPrediction.findMany({
            where: { hynixActualClose: { not: null } },
            orderBy: { createdAt: "desc" },
            take: 14,
        });

        const backtest = predictions.map((p) => {
            const actualClose = p.hynixActualClose;
            const hit = actualClose !== null
                ? (p.hynixPredictedOpen - p.hynixPrevClose) * (actualClose - p.hynixPrevClose) >= 0
                : null;
            return {
                date: p.createdAt.toISOString().slice(0, 10),
                muPrice: p.muCurrentPrice,
                muChangePct: p.muChangePct,
                hynixPrev: p.hynixPrevClose,
                hynixPredicted: p.hynixPredictedOpen,
                hynixActual: actualClose ? Math.round(actualClose * 100) / 100 : null,
                predictedDir: p.hynixPredictedChangePct > 0 ? "up" : "down",
                actualDir: actualClose ? (actualClose > p.hynixPrevClose ? "up" : "down") : null,
                hit,
                diffWon: actualClose ? Math.round((actualClose - p.hynixPredictedOpen) * 100) / 100 : null,
                diffPct: actualClose ? Math.round(((actualClose - p.hynixPredictedOpen) / p.hynixPredictedOpen) * 100 * 100) / 100 : null,
            };
        });

        // 적중률
        const totalHits = backtest.filter(b => b.hit === true).length;
        const totalEvaluated = backtest.filter(b => b.hit !== null).length;
        const accuracy = totalEvaluated > 0 ? Math.round((totalHits / totalEvaluated) * 100) : 0;

        const result = {
            items: backtest.reverse(),
            accuracy,
            totalHits,
            totalEvaluated,
            generatedAt: new Date().toISOString(),
        };

        // Redis 캐시 (10분)
        await setCache(cachedKey, result);
        return result;
    } catch {
        return { items: [], accuracy: 0, totalHits: 0, totalEvaluated: 0 };
    }
}

// ─── GitHub JSON 저장 ───
async function saveToGitHub(prediction: any) {
    try {
        const dir = join(process.cwd(), "Dart_Data", "prediction");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

        const filePath = join(dir, "mu-hynix-predictions.json");
        let records: any[] = [];
        if (existsSync(filePath)) {
            records = JSON.parse(readFileSync(filePath, "utf-8"));
        }
        records.push({
            generatedAt: prediction.generatedAt,
            muPrice: prediction.muCurrentPrice,
            muChangePct: prediction.muChangePct,
            hynixPrevClose: prediction.hynixPrevClose,
            hynixPredicted: prediction.hynixPredictedOpen,
            hynixPredictedChangePct: prediction.hynixPredictedChangePct,
            beta: prediction.beta,
            r2: prediction.r2,
        });
        // 최근 90일만 유지
        if (records.length > 90) records = records.slice(-90);
        writeFileSync(filePath, JSON.stringify(records, null, 2), "utf-8");
    } catch {}
}
