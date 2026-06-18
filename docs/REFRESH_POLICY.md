# 데이터 갱신 정책

> **마지막 검토**: 2026-06-18
> **용도**: 갱신 주기 재검토 시 참조

---

## 갱신 현황

| # | API | 데이터 소스 | 현재 TTL | 권장 갱신 | 비고 |
|---|-----|-----------|----------|----------|------|
| 1 | `/api/quant-data` | Naver Finance | 10분 | - | 시장 게이지, 실시간 무료 |
| 2 | `/api/sector-fear-greed` | Yahoo Finance | 10분 | - | 10 ETF × 5시그널 계산 |
| 3 | `/api/market-overview` | Yahoo Finance | 10분 | - | ETF·섹터·지수·VIX |
| 4 | `/api/nasdaq-movers` | Yahoo Finance | 2시간 | - | 상승/하락 TOP |
| 5 | `/api/mu-hynix` | Yahoo Finance | 10분 | - | MU→하이닉스 예측 |
| 6 | `/api/pageview` | Neon DB | 10분 | - | 방문자 통계 (POST 시 무효화) |
| 7 | `/api/persona` | Yahoo Finance | 72시간 | - | 페르소나 분석 (프리캐싱) |
| 8 | `/api/dashboard` | Naver + Neon DB | 1시간 | - | 대시보드 종합 (스냅샷) |

---

## 리소스 제한

| 리소스 | 한도 | 현재 사용량 | 위험 |
|--------|------|-----------|------|
| **Vercel Functions** | 1M 호출/월 | <1% | 낮음 |
| **Redis Commands** | 500K/월 | <1% | 낮음 |
| **Yahoo Finance** | 비공식 API | - | 과도 호출 시 IP 차단 위험 |
| **Naver Finance** | 비공식 API | - | 비교적 관대함 |
| **Neon DB** | 0.5GB / 100h | 3% | 낮음 |

---

## 갱신 트리거

| 트리거 | 동작 |
|--------|------|
| **TTL 만료** | 자동 재계산 (다음 요청 시) |
| **`?force=true`** | 강제 갱신 (사용자 새로고침 버튼) |
| **POST pageview** | Redis 캐시 무효화 → 다음 GET 시 DB 재조회 |

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-06-18 | setCache에 ttlSec 파라미터 추가 (기존 무시되던 TTL 적용) |
| 2026-06-18 | mu-hynix TTL: 기본(72h) → 600초 |
| 2026-06-18 | nasdaq-movers TTL: 72h → 7200초 (2h) |
| 2026-06-13 | nasdaq-movers 캐시 전략 변경 (10분→장기) |
