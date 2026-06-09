#!/usr/bin/env node
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

(async () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════╗");
  console.log("  ║   CASSANDRA AI — Vercel 배포 헬퍼      ║");
  console.log("  ╚══════════════════════════════════════════╝");
  console.log("");
  console.log("  1. PostgreSQL DB 생성: https://neon.tech");
  console.log("  2. Connection string 복사 후 여기 입력");
  console.log("");

  const dbUrl = await ask("  DATABASE_URL: ");
  if (!dbUrl.trim()) { console.log("  ❌ 필수 항목입니다"); rl.close(); return; }

  // .env 에서 기존 키 읽기
  let dartKey = "";
  let jwtSecret = "";
  try {
    const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf-8");
    dartKey = (env.match(/DART_API_KEY=(.+)/) || [])[1] || "";
    jwtSecret = (env.match(/JWT_SECRET=(.+)/) || [])[1] || "";
  } catch {}

  // 프롬프트 출력
  console.log("");
  console.log("  ═══════════════════════════════════════════");
  console.log("  아래 명령어를 Vercel Dashboard에서 입력하거나,");
  console.log("  vercel deploy 실행 전에 복사하세요:");
  console.log("  ═══════════════════════════════════════════");
  console.log("");
  console.log(`  DATABASE_URL=${dbUrl.trim()}`);
  if (dartKey) console.log(`  DART_API_KEY=${dartKey}`);
  if (jwtSecret) console.log(`  JWT_SECRET=${jwtSecret}`);
  console.log("");
  console.log("  ───────────────────────────────────────────");
  console.log("  Vercel Dashboard에서 환경변수 등록:");
  console.log("    https://vercel.com → 프로젝트 → Settings → Environment Variables");
  console.log("  ───────────────────────────────────────────");
  console.log("");
  console.log("  DB 마이그레이션 (배포 전 1회):");
  console.log("    DATABASE_URL=\"위_연결문자열\" npx prisma migrate deploy");
  console.log("");
  console.log("  배포 실행:");
  console.log("    npx vercel deploy --prod");
  console.log("");
  rl.close();
})();
