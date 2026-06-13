# CASSANDRA AI — 서비스 플로우 & 기술 문서

## 서비스 개요

코스닥 1,822개 종목의 DART 공시를 실시간 분석하여
사명변경·대주주변경·소송·CB 발행 등 **이상 징후 신호**를 탐지하고,
연관된 **주식셀럽**(주요 투자자·관계자)의 관계망을 시각화하는 플랫폼입니다.

## 전체 플로우

```
사용자 로그인 (Google/Naver 이메일)
        │
        ▼
┌───────────────────────────────────────────┐
│  경제 지표 대시보드 (첫 화면)              │
│  · 코스닥 시가총액·등락률·거래량 상위      │
│  · DART 사명변경·대주주·소송·CB 리스트      │
│  · 실시간 검색어 (24시간)                   │
└───────────────────────────────────────────┘
        │
   ┌────┼────┬────────────┐
   ▼    ▼    ▼            ▼
관계망  제보  WIKI        챗봇
```

## 1. 검색 + 관계망 분석 (`/`)

```
검색어 입력 ("피앤씨테크")
  │
  ├─ dart-corp-codes.json (3,920개 코스닥)
  ├─ DART 실시간 API (3개월 공시)
  ├─ 로컬 DB (434개사, 2,523건 공시)
  └─ 지식베이스 (주식셀럽 WIKI)
        │
        ▼
  [관계망 그래프] ← Cytoscape.js 1-hop 관계망
  [공시 분석 패널] ← 위험 신호·카테고리·타임라인
  [핀보드] ← 관심 인물/회사 핀 고정 → 리포트 생성
  [챗봇] ← 자연어 질의 분석
```

## 2. 챗봇 분석 (`/api/chat`)

```
"휴맥스 최근 공시 분석해줘"
  │
  ├─ 1. DB 회사 검색 (434개사, 0ms)
  ├─ 2. DART API 호출 (3,920개사, 500ms)
  ├─ 3. 인물 DB 검색 (주식셀럽)
  └─ 4. DART 실시간 전체 검색 (폴백)
        │
        ▼
  [캐시 저장] ← Redis 72시간 + 인메모리
  [응답] ← 카테고리별 집계 + 타임라인
```

## 3. 경제 지표 대시보드 (`/dashboard`)

```
Naver Finance API (m.stock.naver.com)
  │
  ├─ 시가총액 상위 20개
  ├─ 거래량 상위 20개
  └─ 등락률 상위 20개
        │
        ▼
  [DART 12개월 데이터 매칭]
  ├─ dart-nameChanges-12m.json (6건)
  ├─ dart-majorHolderChanges-12m.json (51건)
  ├─ dart-lawsuits-12m.json (25건)
  └─ dart-cb-issuances-12m.json (7건)
        │
        ▼
  [보고서 생성] ← MD 다운로드
```

## 4. WIKI — 주식셀럽 (`/wiki`)

```
10명 주식셀럽 (주요 투자자·관계자)
  ├─ 신승수, 오종원, 김준범
  ├─ 이준민, 박정규, 안상현
  ├─ 이일준, 이기훈, 구세현
  └─ 배상윤
        │
        ▼
  · 연관 기업 목록 + 역할
  · 특이 패턴 (CB 리픽싱, 무자본 M&A, 증자 반복)
  · 코멘트 / 수정 (집단 지성)
```

## 5. 퀀트 대시보드 (`/quant` — 비로그인)

```
Naver Finance API (m.stock.naver.com)
  │
  ├─ KOSDAQ 등락 종목 비율 → 시장 심리 (공포·중립·과열)
  ├─ NASDAQ 6종목 실시간 가격 (NVDA, AAPL, MSFT, TSLA, META, AMZN)
  └─ Redis 10분 캐시 → 새로고침 시 강제 갱신 (?force=true)
        │
        ▼
  [ARDS-X] NASDAQ Top 100 시장 국면 판단 (0~3)
  [AMQS] AI 반도체 모멘텀 — M7 7종목 집중
  [ARDS] AMQS-M7 대칭 헤지 + 안전자산
  [MU-Hynix] 마이크론 종가 → 하이닉스 시가 예측 (크로스마켓 회귀)
  [백테스트] 14일 적중/미적중 리스트 (DB + GitHub JSON)
  [백테스트 방법론] docs/QUANT_BACKTEST.md
```

## 6. MU → 하이닉스 예측

```
Yahoo Finance (MU + 000660.KS)
  │
  ├─ MU 20일 수익률 → β(베타) 계산
  ├─ Hynix 20일 수익률 → R² 계산
  └─ MU_등락률 × |β| → 하이닉스 예측 시가
        │
        ▼
  [예측] Hynix_시가 = Hynix_전일종가 × (1 + |β| × MU_등락률)
  [저장] Prisma DB → [14일 백테스트]
  [저장] GitHub Dart_Data/prediction/mu-hynix-predictions.json
  [캐시] Redis 10분 TTL
```

## 7. 페이지뷰 추적

```
사용자 방문 → POST /api/pageview → Prisma(Neon DB) 저장
                  ↓                    ↓
           Redis 캐시 무효화        Redis 10분 캐시 적재
                  ↓                    ↓
            GET /api/pageview  →  Redis hit (빠름) / DB fallback
```

## 7. 데이터 파이프라인

```
DART OpenAPI
  │
  ├─ 매일 09:00 / 18:00 동기화 (npm run daily)
  ├─ 8종 룰셋 적용
  │   ├─ 감사위험, 사명변경, 소송/분쟁, 대주주변경
  │   ├─ 대금지연, CB리픽싱, CB발행, 증자/감자
  │   └─ 위험도 점수 0~100
  │
  ├─ DB 저장 (PostgreSQL via Prisma)
  ├─ JSON 갱신 (data/*.json → GitHub)
  └─ Redis 캐시 (72시간 TTL)
```

## 9. 주식 사주 (`/saju` — 비로그인) ★신규

```
사용자 입력 (양력 생년월일·시간·닉네임)
  │
  ├─ 사주 엔진 (lib/saju-engine.ts) → 60갑자 일주 계산
  ├─ 오늘의 일진 → 오행 상생상극 관계
  └─ 5운 점수 (재물·사업·학업·연애·건강) 0-100
        │
        ▼
  [Redis 캐시] 동일 생년월일+시간 → 24시간 캐시 히트
  [종목 궁합] 티커/종목명 입력 → 오행 궁합 분석
  [질문 제한] 하루 3회 (localStorage) · 추천인 보너스 +3회
  [레퍼럴] URL ?ref=코드 → DB 기록 + 통계 (일/누적)
```

## 기술 스택

| 계층 | 기술 |
|---|---|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript |
| DB | PostgreSQL 16 (Neon Serverless) |
| ORM | Prisma 6 |
| 캐시 | Upstash Redis |
| 프론트엔드 | React 19 + Tailwind CSS 4 + Cytoscape.js |
| 외부 API | DART OpenAPI, Naver Finance |
| 인증 | JWT + bcryptjs (3시간 세션) |
| 배포 | Vercel (Hobby, $0) + Neon (Free, $0) |
| LLM | DeepSeek V3 + Claude (예정) |

## 보안

| 항목 | 방식 |
|---|---|
| 비밀번호 | bcrypt (salt 10) |
| JWT | HMAC-SHA256 + timingSafeEqual |
| 쿠키 | httpOnly (인증) + session (플래그) |
| XSS | React 자동 이스케이프 |
| SQL Injection | Prisma 파라미터화 |
| 경로 탐색 | 화이트리스트 |
| API 키 | 환경변수 (.gitignore) |
