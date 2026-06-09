#!/usr/bin/env node
const { PrismaClient } = require("@prisma/client");

async function main() {
  const p = new PrismaClient();
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 20;

  const logs = await p.loginHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true } } },
  });

  console.log(`\n  로그인 기록 (최근 ${Math.min(limit, logs.length)}건)\n`);
  console.log("  시간                  | 이메일                     | 상태 | IP        | 디바이스");
  console.log("  --------------------- | -------------------------- | ---- | --------- | --------");

  for (const r of logs) {
    const time = r.createdAt.toISOString().replace("T", " ").slice(0, 19);
    const email = (r.email || "").padEnd(26);
    const status = r.success ? "✅" : "❌";
    const ip = (r.ip || "localhost").padEnd(9);
    const ua = (r.userAgent || "").replace("Mozilla/5.0 ", "").slice(0, 30);
    console.log(`  ${time} | ${email} | ${status}   | ${ip} | ${ua}`);
  }

  // 통계
  const total = await p.loginHistory.count();
  const success = await p.loginHistory.count({ where: { success: true } });
  const fail = total - success;
  const today = await p.loginHistory.count({
    where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
  });
  console.log(`\n  총 ${total}건 (성공 ${success}, 실패 ${fail}) | 오늘 ${today}건\n`);

  await p.$disconnect();
}

main().catch(console.error);
