#!/bin/bash
# CASSANDRA AI — Supabase Auth 마이그레이션 스크립트
# 사용법: chmod +x scripts/setup-supabase.sh && bash scripts/setup-supabase.sh
set -e

echo "🔐 CASSANDRA AI — Supabase Auth Setup"
echo "========================================="
echo ""

# ─── 1. Supabase 정보 입력 ───
if [ -z "$SUPABASE_URL" ]; then
  read -p "Supabase URL (https://xxxxx.supabase.co): " SUPABASE_URL
fi
if [ -z "$SUPABASE_ANON_KEY" ]; then
  read -p "Supabase Anon Key (eyJhbG...): " SUPABASE_ANON_KEY
fi
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  read -p "Supabase Service Role Key (eyJhbG...): " SUPABASE_SERVICE_ROLE_KEY
fi

echo ""
echo "✅ Supabase 정보 확인 완료"

# ─── 2. 패키지 설치 ───
echo ""
echo "📦 Supabase SDK 설치 중..."
npm install @supabase/supabase-js @supabase/ssr
echo "✅ SDK 설치 완료"

# ─── 3. 환경 변수 설정 ───
echo ""
echo "⚙️  환경 변수 설정 중..."

# .env.local 생성
cat > .env.local << ENVEOF
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# 기존 환경 변수는 .env 에서 로드
ENVEOF
echo "✅ .env.local 생성 완료"

# .env 에도 추가 (서버 전용)
if ! grep -q "SUPABASE_SERVICE_ROLE_KEY" .env 2>/dev/null; then
  echo "" >> .env
  echo "# Supabase Auth" >> .env
  echo "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}" >> .env
fi

# .env.example 업데이트
if ! grep -q "NEXT_PUBLIC_SUPABASE" .env.example 2>/dev/null; then
  echo "" >> .env.example
  echo "# Supabase Auth" >> .env.example
  echo "NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co" >> .env.example
  echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key" >> .env.example
  echo "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key" >> .env.example
fi
echo "✅ 환경 변수 파일 업데이트 완료"

# ─── 4. Supabase 클라이언트 파일 생성 ───
echo ""
echo "📝 Supabase 클라이언트 파일 생성 중..."

mkdir -p src/lib/supabase

# 서버 컴포넌트용 클라이언트
cat > src/lib/supabase/server.ts << 'SRVEOF'
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

// Service Role (서버 전용, RLS 우회)
export function createSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
SRVEOF

# 클라이언트 컴포넌트용
cat > src/lib/supabase/client.ts << 'CLIEOF'
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
CLIEOF

echo "✅ Supabase 클라이언트 파일 생성 완료"

# ─── 5. 완료 ───
echo ""
echo "========================================="
echo "✅ Supabase Auth 설정 완료!"
echo ""
echo "다음 단계:"
echo "  1. Supabase 대시보드 → SQL Editor → 아래 SQL 실행"
echo "     → scripts/supabase-schema.sql"
echo "  2. Supabase 대시보드 → Authentication → Email Templates"
echo "     → 이메일 인증 템플릿 설정"
echo "  3. npm run dev 로 서버 재시작"
echo "========================================="
