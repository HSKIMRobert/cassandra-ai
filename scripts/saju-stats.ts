/**
 * 사주 통계 CLI — npm run saju-stats
 * 사주 입력 인원, 종목 질문 수 (사용자별), 레퍼럴 통계
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🔮 사주 서비스 통계");
    console.log("=".repeat(70));

    const kst = new Date(Date.now() + 9*60*60*1000); const today = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9*60*60*1000);

    // ─── 1. 사주 입력 통계 (SajuLog 기반) ───
    const [totalSubmit, todaySubmit] = await Promise.all([
        prisma.sajuLog.count({ where: { action: "saju_submit" } }),
        prisma.sajuLog.count({ where: { action: "saju_submit", createdAt: { gte: today } } }),
    ]);

    // 유니크 사용자 수 (사주 입력한 사람)
    const [uniqueUsers, todayUnique] = await Promise.all([
        prisma.sajuLog.findMany({ where: { action: "saju_submit" }, select: { nickname: true }, distinct: ["nickname"] }).then(r => r.length),
        prisma.sajuLog.findMany({ where: { action: "saju_submit", createdAt: { gte: today } }, select: { nickname: true }, distinct: ["nickname"] }).then(r => r.length),
    ]);

    console.log(`\n📊 사주 입력 통계`);
    console.log(`  오늘 사주 입력: ${todaySubmit}건 (${todayUnique}명)`);
    console.log(`  누적 사주 입력: ${totalSubmit}건 (${uniqueUsers}명)`);

    // ─── 2. 종목 질문 통계 ───
    const [totalQuery, todayQuery] = await Promise.all([
        prisma.sajuLog.count({ where: { action: "stock_query" } }),
        prisma.sajuLog.count({ where: { action: "stock_query", createdAt: { gte: today } } }),
    ]);

    const [uniqueQueriers, todayQueriers] = await Promise.all([
        prisma.sajuLog.findMany({ where: { action: "stock_query" }, select: { nickname: true }, distinct: ["nickname"] }).then(r => r.length),
        prisma.sajuLog.findMany({ where: { action: "stock_query", createdAt: { gte: today } }, select: { nickname: true }, distinct: ["nickname"] }).then(r => r.length),
    ]);

    console.log(`\n💬 종목 질문 통계`);
    console.log(`  오늘 질문: ${todayQuery}건 (${todayQueriers}명)`);
    console.log(`  누적 질문: ${totalQuery}건 (${uniqueQueriers}명)`);

    // ─── 3. 사용자별 상세 ───
    const userStats = await prisma.sajuLog.groupBy({
        by: ["nickname"],
        where: { action: "saju_submit" },
        _count: { nickname: true },
        orderBy: { _count: { nickname: "desc" } },
        take: 20,
    });

    if (userStats.length > 0) {
        console.log(`\n👤 사용자별 활동`);
        console.log(`  ${"닉네임".padEnd(14)} ${"사주".padEnd(5)} ${"질문".padEnd(5)} ${"마지막".padEnd(12)}`);
        console.log("  " + "-".repeat(45));

        for (const u of userStats) {
            const queryCnt = await prisma.sajuLog.count({
                where: { nickname: u.nickname, action: "stock_query" },
            });
            const last = await prisma.sajuLog.findFirst({
                where: { nickname: u.nickname },
                orderBy: { createdAt: "desc" },
                select: { createdAt: true },
            });
            const lastDate = last ? last.createdAt.toISOString().slice(0, 10) : "-";
            console.log(`  ${u.nickname.padEnd(14)} ${String(u._count.nickname).padEnd(5)} ${String(queryCnt).padEnd(5)} ${lastDate}`);
        }
    }

    // ─── 4. 인기 종목 ───
    const topStocks = await prisma.sajuLog.groupBy({
        by: ["stock"],
        where: { action: "stock_query", stock: { not: null } },
        _count: { stock: true },
        orderBy: { _count: { stock: "desc" } },
        take: 10,
    });

    if (topStocks.length > 0) {
        console.log(`\n🔥 인기 질문 종목`);
        for (const s of topStocks) {
            console.log(`  ${(s.stock || "").padEnd(10)} ${s._count.stock}회`);
        }
    }

    // ─── 5. 페이지 방문 ───
    const [totalSaju, todaySaju] = await Promise.all([
        prisma.pageView.count({ where: { path: "/saju" } }),
        prisma.pageView.count({ where: { path: "/saju", createdAt: { gte: today } } }),
    ]);
    console.log(`\n📈 페이지 방문`);
    console.log(`  /saju: ${todaySaju}건 (오늘) / ${totalSaju}건 (누적)`);

    // ─── 6. 레퍼럴 ───
    const topRefs = await prisma.referral.groupBy({
        by: ["refCode"],
        _count: { refCode: true },
        orderBy: { _count: { refCode: "desc" } },
        take: 5,
    });
    if (topRefs.length > 0) {
        console.log(`\n🔗 레퍼럴 TOP5`);
        for (const r of topRefs) {
            console.log(`  ${r.refCode.padEnd(12)} ${r._count.refCode}명`);
        }
    }

    console.log("\n" + "=".repeat(70));
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
