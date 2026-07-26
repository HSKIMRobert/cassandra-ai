# CASSANDRA AI

> [!IMPORTANT]
> **이 프로젝트는 [vibe-investing](https://github.com/gameworkerkim/vibe-investing) 모노레포의 일부입니다.**
> 더 많은 퀀트 전략, 칼럼, 논문, 보안 도구(LAON VaultGuard), 투자 대시보드를 보려면 메인 레포를 방문하세요.

> **Toss X DART X LLM 리스크 모니터링**
>
> 코스닥 1,822개 종목 DART 공시 실시간 분석 + 관계망 그래프 + 사주 기반 종목 궁합 + 페르소나 투자 AI
>
> **Toss Securities API**로 한국 주식 실시간 시세 제공

**배포**: [dart-monitor-pi.vercel.app](https://dart-monitor-pi.vercel.app) → 목표 **[lab.vibequant.cc](https://lab.vibequant.cc)** ([VibeQuant.cc](https://vibequant.cc))  
**English**: [README_EN.md](README_EN.md) · **이전 계획**: [docs/CLOUDFLARE_MIGRATION.md](docs/CLOUDFLARE_MIGRATION.md)

---

## 리팩토링 간단 계획 (2026-07)

> 현황: DART/KOSDAQ 산출물 한 달째 `[]`, 인명(`personUid`) 매칭 실패 → 관계망 비어 있음.  
> 방향: **수집(배치) ≠ 서빙(Cloudflare)** 분리 후 **VibeQuant.cc**로 통합. $0/월 유지.

| 단계 | 내용 |
|------|------|
| **A. 안정화** | KOSDAQ 파이프라인 복구 + 0건 CI fail · API 인증/레이트리밋 · `personUid` 단일화 |
| **B. 인프라** | Vercel/Neon/Upstash → **CF Pages + Workers + D1/R2/KV**. Auth만 Supabase 유지 |
| **C. 수집** | 고빈도 DART는 **유휴 아이맥 cron**(1순위) / GHA·OCI는 백업. Workers는 읽기만 |
| **D. 제품 이전 순서** | **Quant → Trump → SpaceX → 사주** → (데이터 복구 후) **관계망·코스닥** |
| **E. 통합** | `lab.vibequant.cc` + `api.vibequant.cc/cassandra/*` |

상세 로드맵·무료 티어 예산·성공 기준: **[docs/CLOUDFLARE_MIGRATION.md](docs/CLOUDFLARE_MIGRATION.md)**

```
목표 ($0/월)
├── Cloudflare Pages     → UI (lab.vibequant.cc)
├── Workers + KV/D1/R2   → API · 캐시 · 스냅샷
├── Supabase Auth        → 로그인만 (당분간)
├── Idle iMac / GHA      → DART·인명·관계 배치 ingest
└── (폐기) Vercel · Neon · Upstash 서빙 역할
```

---

## 핵심 아이디어 (현행 → 이전 중)

**현행 $0/월** — Vercel + Neon + Upstash + Supabase + GHA.  
**목표** — Cloudflare 단일 서빙 + 배치 ingest (아이맥). GitHub `data/*.json`은 R2로 이전.

```
인프라 비용: $0/월 (현행)
├── Vercel Hobby          → 웹 호스팅 + API ($0)  ⚠ CF Pages로 이전
├── Neon Free             → PostgreSQL 0.5GB ($0) ⚠ D1/R2로 이전
├── Upstash Redis Free    → 캐시 256MB ($0)       ⚠ KV로 이전
├── Supabase Auth Free    → 50,000 MAU ($0)       ✓ Auth만 유지
└── GitHub Actions        → 크롤러                  → iMac 주력 + GHA 백업
```

---

## 메뉴 구성

| 메뉴 | 경로 | 인증 | 설명 |
|------|------|------|------|
| 코스닥 시그널 | `/dashboard` | 로그인 | DART 공시 기반 고위험 시그널 (CB발행, 소송, 대주주변경 등) |
| 퀀트 대시보드 | `/quant` | 로그인 | 시장 오버뷰, ETF, 섹터, 지수, Fear & Greed, MU-Hynix 예측 |
| 페르소나 투자 | `/persona` | 로그인 | Buffett, Wood, Dalio 3인 AI 종목 분석 |
| 주식 사주 | `/saju` | 공개 | 60갑자 기반 사주 궁합 + 종목 추천 |
| 관계망 분석 | `/` | Expert | Cytoscape.js 관계망 (회사-인물-법인) |
| 제보/분석 | `/board` | Expert | 사용자 제보 + AI 분석 + 친구 초대 |
| WIKI | `/wiki` | Expert | 주식셀럽 정보 + 동명이인 관리 |
| 인명검색 | `/person-search` | Expert | DART 인물 검색 + 이력 |
| 관리자 | `/admin` | Admin | 가입자 통계, Expert 승인, 레퍼럴, 사주 로그 |

---

## 주요 기능

### 코스닥 시그널
- **Toss Securities API**로 한국 주식 실시간 시세 제공
- DART 12개월 실공시 데이터 (사명변경 7건, 대주주변경 48건, 소송 26건)
- CB 발행/리픽싱 67건 (리픽싱 6건 고위험)
- 8종 룰셋: CB발행, CB리픽싱, 사명변경, 대주주변경, 소송/분쟁, 증자/감자, 감사위험, 대금지연
- GitHub Actions 매일 09:00/18:00 KST 자동 동기화

### 퀀트 대시보드
- 시장 오버뷰: 인기 ETF 10종, 섹터 11종, 주요 지수(SPY, QQQ, DIA, IWM), VIX
- 섹터별 Fear & Greed: 10개 US 섹터 ETF, 5개 시그널 가중평균
- ARDS-X: NASDAQ Top 100 시장 국면 4단계 판단
- AMQS/M7: AI 반도체 모멘텀 전략
- MU -> SK Hynix: 크로스마켓 회귀 예측 (71% 적중률)
- NASDAQ 상승/하락 TOP (데일리 + 주간)

### 주식 사주
- 60갑자 기반 4주(년/월/일/시) 완전 계산
- 십신, 대운(80년), 지장간, 합충형해, 12운성, 신강/신약, 용신/희신/기신
- 일간 기준 5운 점수(재물/사업/학업/연애/건강)
- 주간/월간/연간 운세 시뮬레이션 + 트렌드 + 종합 해설
- 종목 오행 궁합 분석 (티커/한글명 검색)
- 질문 제한: 비로그인 3회, 로그인 5회, 초대당 +3회

### 페르소나 투자
- Warren Buffett: 가치 투자, 경제적 해자, 저평가 우량주
- Cathie Wood: 파괴적 혁신, AI/로보틱스/유전체 집중
- Ray Dalio: 거시경제 사이클, 리스크 패리티, 올웨더 전략
- Yahoo Finance 실시간 가격 기반 시나리오 분석
- 레버리지 ETF 자동 감지 및 경고
- 12종목 X 3페르소나 = 36건 자동 프리캐싱

### 인증 시스템
- Supabase Auth: Google OAuth + 이메일/비밀번호
- 3단계 등급: 일반회원(Google 로그인) / Expert(언론/공공기관 이메일 인증) / 관리자
- Expert: 도메인 검증 -> 관리자 승인 -> OTP 인증 -> 6개월 재인증
- Expert 초대: 언론인 이메일 입력 -> 가입 링크 생성 -> 초대 이력 관리

---

## 데이터

| 항목 | 규모 |
|------|------|
| DB 기업 | 622개사 |
| DB 공시 | 984건 |
| DB 시그널 | 141건 |
| DB 관계 | 5,000+ CorpPersonRelation |
| DART 매핑 | 3,920개 코스닥 |
| 실시간 시세 | Toss Securities API |
| 인기 ETF | NASDAQ 10종 |
| 페르소나 종목 | NASDAQ/KOSPI 200 |

---

## 실행

```bash
npm run dev              # 개발 서버
npm run daily            # 일일 DART 동기화 + 시그널 생성
npm run extract-cb       # CB 발행/리픽싱 추출
npm run extract-dart     # DART 12개월 이벤트 추출
npm run saju-stats       # 사주 서비스 통계
npm run logs             # 로그인/방문자 통계
```

---

## 기술 스택

| 계층 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 + TypeScript |
| DB | PostgreSQL (Neon Serverless) → D1/R2 이전 예정 |
| ORM | Prisma 6 → Drizzle 검토 |
| 캐시 | Upstash Redis → Workers KV 이전 예정 |
| 인증 | Supabase Auth (Google OAuth) |
| UI | React 19 + Tailwind CSS 4 + Recharts + Cytoscape.js |
| 실시간 시세 | Toss Securities API + Yahoo Finance |
| 외부 API | DART OpenAPI, Naver Finance |
| 배포 | Vercel → Cloudflare Pages/Workers (VibeQuant.cc) |

---

## 환경변수

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | Neon PostgreSQL |
| `DART_API_KEY` | DART OpenAPI |
| `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET` | Toss Securities API |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버사이드 |
| `UPSTASH_REDIS_REST_URL` | Redis 캐시 |
| `UPSTASH_REDIS_REST_TOKEN` | Redis 캐시 |
| `DEEPSEEK_API_KEY` | LLM 분석 (선택) |

---

## 문서

- [CLOUDFLARE_MIGRATION.md](docs/CLOUDFLARE_MIGRATION.md) — **CF 이전 · VibeQuant 통합 · 수집/서빙 분리**
- [ROADMAP.md](docs/ROADMAP.md) — 작업 로드맵 + 히스토리 (P0 버그·품질)
- [REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md) — 관계망·인명 매칭 리팩토링
- [SERVICE_FLOW.md](docs/SERVICE_FLOW.md) — 서비스 흐름도
- [CHANGELOG.md](docs/CHANGELOG.md) — 변경 이력
- [AUTH_SYSTEM.md](docs/AUTH_SYSTEM.md) — 인증 시스템 설계
- [EXPERT_MANUAL.md](docs/EXPERT_MANUAL.md) — Expert 인증 매뉴얼
- [REFRESH_POLICY.md](docs/REFRESH_POLICY.md) — 데이터 갱신 정책
- [SOCIAL_POSTS.md](docs/SOCIAL_POSTS.md) — 소셜 미디어 포스팅
- [dev_llms.txt](docs/dev_llms.txt) — LLM 개발 명세

---

## 라이선스

공익 목적. 상업적 이용 제한.
