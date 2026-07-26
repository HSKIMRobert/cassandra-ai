# CASSANDRA AI — 작업 로드맵

> 최종 갱신: 2026-07-26 · 기준 커밋 `51b7082` · 배포 [dart-monitor-pi.vercel.app](https://dart-monitor-pi.vercel.app)
> 관련: [CHANGELOG.md](CHANGELOG.md) (완료 이력) · [REFACTORING_PLAN.md](REFACTORING_PLAN.md) · [리팩토링_평가0627.md](리팩토링_평가0627.md)

---

## 0. 현재 상태 요약

| 영역 | 상태 |
|------|------|
| 배포 | ✅ Vercel 정상 (`/`, `/dashboard`, `/quant`, `/saju`, `/persona`, `/tqqq`, `/trump`, `/spacex` 전부 200) |
| 코드베이스 | src 114개 TS/TSX (~18.4k LOC), API 라우트 41개, scripts 31개 |
| 자동화 | GitHub Actions 6종 (daily-sync, batch-analysis, elestock, person-history, person-scrape, spacex-quant) |
| **테스트** | ❌ **0건** — 테스트 프레임워크·설정 자체가 없음 |
| **CI** | ❌ **빌드/타입체크/린트 워크플로우 없음** (데이터 동기화 워크플로우만 존재) |
| **린트** | ❌ ESLint 설정 파일 없음 (`npm run lint`은 `next lint` — Next 15에서 deprecated) |

---

## 1. P0 — 지금 깨져 있는 것

### 1-1. 🔴 KOSDAQ 이상징후 파이프라인 산출물이 한 달째 전부 0건

`data/kosdaq-anomaly-report.json` (2026-07-26 03:40 생성분):

```json
{ "totalStocks": 0,
  "summary": { "nameChanges": 0, "majorHolderChanges": 0, "purposeAdditions": 0,
               "lawsuits": 0, "cbIssuances": 0, "volatilityScoreGt0": 0 } }
```

`data/kosdaq-cb-issuances.json` · `kosdaq-lawsuits.json` · `kosdaq-name-changes.json` ·
`kosdaq-major-holder-changes.json` · `kosdaq-purpose-additions.json` · `small-caps.json` — **전부 2바이트(`[]`)**.
git 이력상 과거엔 26KB까지 채워졌으나 `f81e2f3`(2026-06-26) 이후 계속 빈 배열.

- [ ] `scripts/extract-kosdaq.ts` 실패 지점 추적 — Toss API IP 화이트리스트 / 응답 스키마 변경 / 시총 필터(5,000억) 조건 중 어디서 0건이 되는지
- [ ] GHA `daily-sync.yml`에 **산출물 0건이면 job 실패** 처리 추가 (지금은 조용히 빈 파일을 커밋 중)
- [ ] 정상 동작 확인 후 `/dashboard` 코스닥 시그널 표시 재검증

### 1-2. 🔴 Expert 전용 데이터가 API로 무인증 노출

`src/middleware.ts:12` — `API_PREFIXES = ["/api/", ...]` 로 **모든 API 라우트가 미들웨어 인증을 우회**.
따라서 각 라우트가 스스로 인증해야 하는데, 41개 중 40개에 인증 코드가 없음.

운영 배포에서 실제 확인 (쿠키 없이 curl):

| 엔드포인트 | 결과 | 페이지 등급 |
|---|---|---|
| `GET /api/graph?q=삼성` | **200 · 14KB 관계망 반환** | `/` = Expert 전용 |
| `GET /api/search?q=삼성` | **200 · 4.8KB** | `/search` = Expert 전용 |
| `GET /api/dashboard` | **200 · 3.6KB 시그널** | `/dashboard` = 로그인 필요 |

- [ ] `src/lib/admin-auth.ts`의 `requireAdmin()` 패턴을 따라 `requireExpert()` / `requireUser()` 헬퍼 추가
- [ ] Expert 등급 라우트에 적용: `graph`, `search`, `person-search`, `person/[uid]`, `corp/[code]`, `fund/[uid]`, `detail`, `samename`, `namechanges`, `board`, `board/[id]`, `comment`, `vote`
- [ ] 로그인 등급 라우트에 적용: `dashboard`, `monitor`, `report`, `quant`, `quant-data`, `chat`
- [ ] `middleware.ts`의 `EXPERT_EMAILS` 하드코딩(`gameworker@gmail.com` 외 2건) → DB `AppUser.role` 조회로 전환

### 1-3. 🟠 LLM 호출 라우트에 인증·레이트리밋 둘 다 없음

`/api/chat`, `/api/persona`, `/api/saju`, `/api/analyze-cluster`, `/api/trump`, `/api/seohak`, `/api/spacex/news`
— 전부 무인증이며 코드베이스 전체에 레이트리밋 구현이 **한 줄도 없음**. DeepSeek/DART 키 비용이 외부에서 소진 가능.

README의 "사주 질문 제한 비로그인 3회 / 로그인 5회"는 클라이언트 측 제한이라 서버에서 강제되지 않음.

- [ ] Upstash Redis 기반 IP+유저 레이트리밋 도입 (`@upstash/ratelimit` — Redis는 이미 사용 중)
- [ ] 사주 질문 횟수 제한을 서버(Redis 카운터)로 이관
- [ ] 캐시 미스 시에만 LLM 호출되도록 각 라우트 재확인

### 1-4. 🟠 남은 DeepSeek URL 불일치

이슈 I는 `a4043f1`에서 `analyze-cluster`만 고쳐졌고 한 곳이 누락.

- [ ] `src/app/api/spacex/news/route.ts:142` — `https://api.deepseek.com/chat/completions` → `/v1/chat/completions`
- [ ] DeepSeek 호출을 `src/lib/deepseek.ts` 단일 클라이언트로 통합 (현재 4개 라우트에 URL·헤더·에러처리 중복)

---

## 2. P1 — 품질 안전망 (현재 완전 부재)

### 2-1. CI 파이프라인

`.github/workflows/`에 데이터 동기화 워크플로우 6개만 있고 **코드 검증 워크플로우가 없음**. 타입 오류가 Vercel 배포 시점에야 드러남.

- [ ] `.github/workflows/ci.yml` — PR/푸시 시 `tsc --noEmit` + `next build`
- [ ] ESLint 9 flat config 도입 (`eslint.config.mjs`) — `next lint`는 Next 15에서 deprecated
- [ ] `package.json`에 `typecheck` 스크립트 추가

### 2-2. 테스트

- [ ] Vitest 도입
- [ ] 순수 로직 우선 커버: `saju-engine.ts`(934줄) · `risk-flags.ts` 3레이어 룰셋 · `quant-calc.ts` · `mu-hynix-predict.ts` · `person-uid.ts`
- [ ] `dart-parsers.ts` — DART 응답 픽스처 기반 파서 테스트 ([리팩토링_평가0627.md](리팩토링_평가0627.md)에서 "작성됐으나 동작 증거 없음"으로 지적된 항목)
- [ ] API 라우트 스모크 테스트 (인증 등급별 200/401 검증)

### 2-3. 입력 검증

`zod`가 dependency에 있으나 **import 하는 파일이 0개**. 대부분의 POST 라우트가 `await req.json() as any`로 처리 중.

- [ ] POST 라우트 zod 스키마 도입 — `chat`, `saju`, `persona`, `board`, `comment`, `vote`, `wiki`, `tqqq`
- [ ] `as any` 캐스트 제거 (`src/app/page.tsx` 16곳, `nasdaq-movers/route.ts` 5곳, `saju/page.tsx` 4곳)

### 2-4. Prisma 스키마 드리프트

`prisma/migrations/` 마지막 항목이 `20260611160045_add_batch_job`. 이후 `isCurrent`, `@@unique`, `AppUser.phone`, `ExpertInvite.phone`, `TqqqLog` 등은 전부 `db push`로만 반영됨 (467줄 스키마 vs 13개 마이그레이션).

- [ ] 현재 운영 DB 상태를 기준으로 baseline 마이그레이션 생성 → 이후 `migrate deploy`로 전환
- [ ] 롤백·리뷰 가능한 스키마 변경 절차 문서화

---

## 3. P2 — 미완/보류 기능

### 3-1. 반도체 3종 비교 엔진 (커밋 안 된 채 방치)

`src/lib/semiconductor-trio.ts`(450줄) + `src/app/api/semiconductor-trio/route.ts`(27줄) 이
2026-07-11 작성 후 **untracked 상태로 로컬에만 존재**. MU · 000660.KS · SKHYV 상관계수·ADR 프리미엄·페어트레이딩 z-score 구현 완료, UI 없음.

- [ ] 동작 검증 후 커밋
- [ ] `/quant` 페이지에 섹션 추가 (기존 MU→Hynix 예측과 통합 또는 분리 결정)
- [ ] 미채택 시 명시적으로 삭제 — 지금이 가장 애매한 상태

### 3-2. 기존 로드맵 이월 항목

**데이터 확장**
- [ ] 전체 코스닥 상시 공시 캐싱 (현행: 시총 5,000억 이하 `--cap-filter`)
- [ ] DART `dsab007` 인물명 검색 파이프라인
- [ ] 공시-뉴스 크로스레퍼런스
- [ ] 공시 본문(XBRL/XML) 파싱 → `Filing.involvedPeople`·`involvedFunds` 실제 데이터 채우기 (현재 2,630건 공시 중 제목 regex만 매칭, 배열 항상 빈 상태)

**관계망 데이터 커버리지** ([REFACTORING_PLAN.md](REFACTORING_PLAN.md) 연계)
- [ ] Fund(조합·SPC·투자사) 노드 생성 검증 — `prisma.fund.create` 호출 지점이 `fund-builder.ts`에 작성됐으나 실제 DB 적재 확인 필요
- [ ] `CorpFundRelation`·`FundPersonRelation` 엣지가 그래프에 실제로 출현하는지 엔드투엔드 검증
- [ ] EntityGraph risk badge 시각화 — 리스크 스코어 70+ 노드 경고 배지 표시
- [ ] `/api/risk-summary` — 블랙리스트 인물·조합 집계 API 신규

**LLM 파이프라인**
- [ ] DeepSeek V3 NER 코스닥 연동 → 공시 본문 인물·법인 추출 (구조화 API 폴백)
- [ ] 다중 LLM 앙상블 → 신호 발화 (DeepSeek + Claude 등)
- [ ] 주식셀럽(WIKI) → 시스템 프롬프트 주입 (페르소나 분석 확장)

**Trump Pick 고도화**
- [ ] Truth Social 유료 API 또는 스크래핑 서비스 연동 (직접 RSS 차단 대응)
- [ ] 정책 카테고리별 섹터 영향 이력 DB화
- [ ] 신규 포스트 감지 → 카카오/슬랙 Webhook 알림

**인프라**
- [ ] OCI Always Free 크롤러 서버 (Vercel 10초 제한 우회, 장기 백필 실행)
- [ ] ~~CI/CD 자동화~~ → **§2-1로 승격**

### 3-3. 리스크 엔진 검증

- [ ] `scripts/backtest-riskflags.ts` 정기 실행 → 룰셋별 TP율을 [QUANT_BACKTEST.md](QUANT_BACKTEST.md)에 반영
- [ ] TP율 낮은 룰 임계값 조정 또는 제거 (현재 8종 룰셋을 사실상 동일 신뢰도로 취급)

### 3-4. Cloudflare 무료 티어 이전 (인프라 마이그레이션)

> 기존 $0/월 인프라(Vercel + Neon + Upstash + Supabase)를 Cloudflare 생태계로 통합.
> 목표: 싱글 벤더 의존성 감소 + 무료 티어 한도 상향 (Workers 10M/월, D1 5GB, KV 1GB, R2 10GB).

#### 이전 대상 매트릭스

| 현행 | 대체 (Cloudflare) | 주요 변경점 |
|------|------------------|-------------|
| Vercel Hobby | **Cloudflare Pages** (정적) + **Workers** (API) | `@opennextjs/cloudflare` 어댑터 또는 API만 Workers 마이그레이션 |
| Neon PostgreSQL | **D1** | Prisma → Drizzle ORM, PostgreSQL SQL → SQLite 호환 SQL 전환 |
| Upstash Redis (256MB) | **Workers KV** (1GB) | `redis-cache.ts` → KV API (`PUT`/`GET` with `expirationTtl`) |
| Supabase Auth (50K MAU) | **Supabase 유지** 또는 **Cloudflare Access** | Supabase 측 세션 쿠키 → Workers 환경 `Request.cf` 기반 검증 |
| GitHub Actions (크롤러) | **Workers Cron Triggers** | `daily-sync.yml` 워크플로우 → Workers ScheduledEvent (`cron: "0 0,9 * * *"`) |
| GitHub JSON CDN | **R2** (10GB) | `data/*.json` 정적 파일 → R2 버킷 (CDN 캐시 기본 제공) |
| Vercel Functions (API 41개) | **Workers** | API 라우트 41개 → Workers `fetch` 핸들러 (`itty-router` 또는 `Hono`) |

#### migration 단계

- [ ] **Phase 1 — 평가·PoC** (1~2일)
  - Next.js Pages 정적 export 호환성 확인 (`next.config.js` → `output: "export"`? `@opennextjs/cloudflare`?)
  - Prisma → Drizzle 전환 PoC: `schema.prisma` → `drizzle/schema.ts`, D1 어댑터 연결 테스트
  - Redis → KV 마이그레이션: `redis-cache.ts` 래퍼를 KV API로 재구현 (인메모리 폴백도 동일하게 유지)
  - Supabase 세션 → Workers에서 검증 가능 여부 확인 (`supabase-js`의 `createServerClient`가 Workers 호환인지)
- [ ] **Phase 2 — API 이전** (3~5일)
  - `src/app/api/` 41개 라우트 → Workers fetch 핸들러 (`itty-router` 기반)
  - D1 데이터 마이그레이션: Neon PostgreSQL dump → D1 import
  - KV 캐시 키 재매핑 (현행 `redis-cache.ts`의 키 패턴 유지)
  - GHA `daily-sync.yml` → Workers Cron (`src/cron/daily.ts`)
- [ ] **Phase 3 — 프론트엔드 + SSG** (2~3일)
  - `/quant`, `/persona`, `/saju`, `/trump`, `/spacex` → 정적 페이지 (데이터는 클라이언트 측 fetch → Workers API)
  - `/dashboard`, `/`, `/board`, `/wiki`, `/admin` → 인증필요 CSR 페이지
  - Vercel DNS → Cloudflare DNS 전환
- [ ] **Phase 4 — 정리·폐기** (1일)
  - Neon DB · Upstash Redis 계정 다운그레이드 (데이터 보존 기간 설정)
  - Vercel 프로젝트 유지 (롤백 대비, 도메인만 이전)

#### 리스크

| 리스크 | 영향 | 대응 |
|--------|------|------|
| Next.js App Router → Workers 제약 | ISR·미들웨어·Server Actions 미지원 가능 | API만 Workers로, 정적/CSR은 Pages로 분리 |
| Prisma → Drizzle 스키마 불일치 | 24개 테이블 관계·인덱스 누락 | `prisma db pull` → Drizzle 자동 생성 도구 사용 |
| KV consistency model (eventual) | 캐시 캐싱 용도 → 무관, 단 aggressive 업데이트 시 stale | KV 대신 D1으로 캐시 필요 케이스 분리 (e.g., `pageview`) |
| Supabase SSR → Workers 환경 | `@supabase/ssr`의 쿠키 기반 세션이 Workers에서 작동 안 할 가능성 | Supabase REST API 직접 호출로 폴백, JWT 검증만 Workers에서 수행 |
| Vercel 10s → Workers 30s CPU 제한 | `daily-sync`, `backfill-*` 등 장기 실행 스크립트 제한 | Workers Cron으로 분할 실행, Queues 활용한 청크 처리 |

---

## 4. P3 — 성능 · 문서 · 정리

### 4-1. 응답 지연

운영 배포 콜드 응답 실측 (2026-07-26):

| 엔드포인트 | 응답시간 |
|---|---|
| `/api/dashboard` | **7.2s** |
| `/api/search?q=삼성` | 5.3s |
| `/api/graph?q=삼성` | 5.3s |

- [ ] `/api/dashboard` — 캐시 미적용 (`getCache` 호출 없음). Redis 캐싱 추가
- [ ] `/api/search`·`/api/graph` — DART 실시간 조회 폴백이 지연 원인인지 계측 후 타임아웃 설정
- [ ] `/api/trending` 운영 응답이 `[]` — SearchLog 24시간 집계가 비어 있음. 의도된 것인지 확인

### 4-2. 번들·의존성

- [ ] `puppeteer`(^25)가 dependencies에 있음 — `person-scrape` 스크립트 전용인데 Vercel 배포에 포함됨. devDependencies 이동 검토
- [ ] `@anthropic-ai/sdk` — Trump Pick이 DeepSeek로 전환(`bd2ff60`)된 뒤 실사용처 확인 필요
- [ ] 대형 클라이언트 컴포넌트 분할: `quant/page.tsx`(1,032줄), `BoardPage.tsx`(828줄), `tqqq/page.tsx`(743줄), `saju/page.tsx`(727줄)

### 4-3. 문서 정합성

- [ ] README 데이터 규모(622개사 / 984건)와 CHANGELOG(1,090개사 / 1,083건) 불일치 — DB 실측 기준으로 통일하고 자동 갱신 스크립트화
- [ ] [CHANGELOG.md](CHANGELOG.md)에 v1.4 이후 항목 추가 (TQQQ 일반 공개 `478bf6f`, 섹터 Top 3 `fe48a6c`)
- [ ] `docs/CHANGELOG.md` 스크립트 가이드의 절대경로 `/Users/dennis/dart-monitor` 제거
- [ ] `docs/` 27개 문서 중 리팩토링 관련 3종(`REFACTORING_PLAN.md`, `리팩토링_claude_plan.md`, `리팩토링_평가0627.md`) 결론 병합 후 아카이브

---

## 5. 권장 처리 순서

| 순서 | 작업 | 근거 |
|---|---|---|---|
| 1 | §1-1 KOSDAQ 파이프라인 복구 | 서비스 핵심 기능이 한 달째 빈 데이터 |
| 2 | §1-2 API 인증 게이트 | Expert 전용 데이터가 실제로 공개 노출 중 |
| 3 | §1-3 레이트리밋 | LLM/DART 키 비용 무방비 |
| 4 | §1-4 DeepSeek URL 1줄 + 클라이언트 통합 | 즉시 가능 |
| 5 | §2-1 CI (tsc + build) | 이후 모든 변경의 안전망 |
| 6 | §2-2 순수 로직 테스트 | "작성 = 동작" 착각 방지 ([리팩토링_평가0627.md](리팩토링_평가0627.md) §5) |
| 7 | §3-2 관계망 데이터 커버리지 검증 | Fund 노드·엣지 실제 적재 확인, §1-1 복구 후 우선 |
| 8 | §3-2 공시 본문(XBRL) 파싱 | 2,630건 공시의 인물·법인 엣지 누락 해소 |
| 9 | §3-1 semiconductor-trio 커밋 또는 삭제 | 미결 상태 해소 |
| 10 | §4-1 API 응답 지연 (dashboard 7.2s) | 사용자 경험 직접 영향 |
| — | §3-4 Cloudflare 마이그레이션 PoC | §1~§2 완료 후 본격 추진. Phase 1 평가 먼저 |

# 부록 — 완료 이력

> v1.0 이후 상세 변경 이력은 [CHANGELOG.md](CHANGELOG.md) 참조.

## v1.4 (2026-07-11 ~ 07-24)
- [x] TQQQ 물타기 페이지 일반 유저 공개 + 개인 매수 기록 분리 저장 (`478bf6f`)
- [x] NASDAQ 100 섹터별 Top 3 AMQS 퀀트 분석 (`fe48a6c`), 마감후 캐시 TTL 12h (`8dba7ea`)
- [x] README v1.4 한글/영문 — Toss API + 최신 기능 반영 (`e9636a9`)

## v1.0 ~ v1.3 (2026-06-27 ~ 07-04)
- [x] 보안 감사 3차 — admin API 인증 누락, `adminEmail` 파라미터 우회, `.env` 런타임 읽기, debug 키 노출 (`985f1ca`, `11becd0`, `ebef59a`)
- [x] Expert 초대 확장 — 가입 폼 강화 + Expert 초대 이력 + `/admin/experts` (`8830f62`)
- [x] 초대 로그인 불가 근본 원인(`SUPABASE_SERVICE_ROLE_KEY` 미설정) 수정 (`38a8ae9`)
- [x] 동명이인 관리자 UI `/admin/samename` + WIKI 배너 (`0900863`)
- [x] 이슈 F·H·I 수정 — 노드 슬라이싱 30/15 상향, 캐시 TTL 30분, DeepSeek `/v1/` (`a4043f1`) ※ spacex/news 1곳 누락 → §1-4

## v0.8 ~ v0.9 (2026-06-27)
- [x] P0 핫픽스 6건 — corp 404, 공시 표시 역설, BFS 병렬화, 캐시 TTL, 복합검색 AND (`82e4dec`)
- [x] Phase 1 스키마 정합 — `isCurrent` + `@@unique`, 중복 5,105건 제거 (`514cd30`)
- [x] Phase 2 파서/빌더 — `dart-parsers.ts`, `fund-builder.ts`, `backfill-relations.ts` (`e7e1b2e`)
- [x] Phase 3 리스크 엔진 — `risk-flags.ts` 3레이어 (`69fce5e`)
- [x] daily-sync DB Corp 기준 전환 + GHA 백필/시총/동명이인 스텝 추가

## v0.7.0 (2026-06-24)

### 코어
- [x] 관계망 그래프 (Cytoscape.js) + 통합 검색
- [x] 실시간 검색어 순위 (24시간)
- [x] 핀보드 + 리포트 (MD 다운로드)
- [x] 동명이인 생년월일 구분 (SameNameGroup)
- [x] BAD ASS / Good 투표 + 댓글
- [x] 제보·분석요청 게시판
- [x] CB 신호 6종 자동 탐지
- [x] 법인명 변경 추적 (CorpEvent)
- [x] 경제 지표 대시보드
- [x] 코스닥 100종목 추출 + JSON 데이터
- [x] 3,920개 상장사 DART corp_code 매핑
- [x] 로그인 + 세션 (Supabase SSR Auth)
- [x] 챗봇 DART 분석 (4단계 검색)
- [x] 공시 분석 패널 (위험 신호 + 카테고리)
- [x] WIKI — 주식셀럽 (10명 + 코멘트)
- [x] DART 지식베이스 (사명변경·대주주·소송 82건)
- [x] 시총 하위 200개사 3개월 공시 캐싱
- [x] 일일 공시 동기화 (`npm run daily` + 8종 룰셋)
- [x] Vercel + Neon 배포 ($0/월)
- [x] Naver Finance → Toss 증권 Open API 전환 (`56056d0`)
- [x] GitHub Actions Node 20 → 24 (`a33a6a1`)

### SpaceX 대시보드 (`/spacex`)
- [x] SPCX 티커 교체 (UFO → SPCX), 스테일 종목 자동 DB 정리
- [x] Yahoo Finance 신규 IPO null-price 처리
- [x] nitter 차단 → Google News RSS 폴백
- [x] 뉴스 HTML 엔티티 디코딩 수정

### 퀀트 대시보드 (`/quant`) 실데이터 전환
- [x] ARDS-X: 더미 → QQQ 실데이터(MA20/MA60/RSI/VIX) + 레짐 4단계
- [x] AMQS-M7: 하드코딩 → NVDA·AVGO·AMD·QCOM·ASML·MU·TSM 실데이터
- [x] ARDS 헤지: 고정 비율 → `calculateHedgeWeight(regime)` 동적 산출
- [x] NASDAQ 주간 Top: 하드코딩 → `range=5d` 실데이터
- [x] Redis 캐시 30분(장중) / 2시간(마감후)

### TQQQ 투자 관리 (`/tqqq`)
- [x] QQQ/TQQQ/QLD/TLT/IEF 실시간 시세 (Yahoo Finance 6mo)
- [x] RSI14·Williams%R·SMA20/50·drawdown20d 자동 계산
- [x] 딥바잉 트랜치 5단계 (-3%/-5%/-8%/-12%/-20%)
- [x] 일일 액션 알람 (STRONG_BUY / BUY / WATCH / HOLD / REBALANCE)
- [x] 투자 로그 입력/조회/삭제 (`TqqqLog`)
- [x] DCA 플래너 + 백테스트 시뮬레이션
- [x] QLD vs TQQQ 비교 테이블

### 🇺🇸 Trump Pick (`/trump`)
- [x] Truth Social Mastodon API → RSS 애그리게이터 → 직접 RSS 3단계 폴백
- [x] Google News RSS 7개 쿼리 + Yahoo News 병렬 수집
- [x] DeepSeek V3 분석: 의도 요약·무드·종목 픽 BUY/SELL
- [x] 증분 캐싱: 해시 비교 → 신규만 번역, 변동 없으면 재분석 안 함
- [x] Redis 3키 (`trump:seen-hashes` 48h / `trump:items` 24h / `trump:analysis` 1h)
- [x] 한국어 요약 + 원문 토글, 투자 위험 고지

### 네비게이션
- [x] 인명검색 상단 메뉴 제거 → WIKI 탭 내부로 통합
- [x] Trump Pick 중복 헤더 렌더링 버그 수정
