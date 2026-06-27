#!/bin/bash
# Toss 증권 Open API 키 설정
# 실행: bash scripts/setup-toss.sh

ENV_FILE="$(dirname "$0")/../.env"

echo ""
echo "Toss 증권 Open API 키 설정"
echo "발급: https://openapi.tossinvest.com"
echo ""

read -p "TOSS_CLIENT_ID: " CLIENT_ID
read -s -p "TOSS_CLIENT_SECRET: " CLIENT_SECRET
echo ""

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "❌ 값을 입력해주세요."
  exit 1
fi

# 기존 항목 제거 후 추가
if [ -f "$ENV_FILE" ]; then
  sed -i '' '/^TOSS_CLIENT_ID=/d' "$ENV_FILE"
  sed -i '' '/^TOSS_CLIENT_SECRET=/d' "$ENV_FILE"
else
  touch "$ENV_FILE"
fi

echo "TOSS_CLIENT_ID=$CLIENT_ID" >> "$ENV_FILE"
echo "TOSS_CLIENT_SECRET=$CLIENT_SECRET" >> "$ENV_FILE"

echo "✅ .env 저장 완료"
echo ""
echo "테스트:"
echo "  npx tsx scripts/backfill-marketcap.ts --limit 5"
