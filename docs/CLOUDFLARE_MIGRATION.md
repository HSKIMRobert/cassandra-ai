# CASSANDRA → VibeQuant.cc · Cloudflare 리팩토링 로드맵

> 최종 갱신: 2026-07-26  
> 로컬: `/Users/dennis/dart-monitor` · 원격: [gameworkerkim/cassandra-ai](https://github.com/gameworkerkim/cassandra-ai)  
> 현재 배포: [dart-monitor-pi.vercel.app](https://dart-monitor-pi.vercel.app)  
> 목표 호스트: `lab.vibequant.cc` (또는 `cassandra.vibequant.cc`) under [VibeQuant.cc](https://vibequant.cc)

관련: [ROADMAP.md](ROADMAP.md) · [REFACTORING_PLAN.md](REFACTORING_PLAN.md) · [REFRESH_POLICY.md](REFRESH_POLICY.md)

---

## 0. 왜 리팩토링하는가

| 문제 | 현황 | 영향 |
|------|------|------|
| **DART 수집 실패** | `data/kosdaq-*.json` 전부 `[]` (2026-06-26 이후) | 코스닥 시그널·대시보드 무의미 |
| **인명 매칭 실패** | `personUid` 형식 불일치 + 제목 regex만 사용 | 관계망 1-hop도 비어 있음 |
| **멀티 SaaS SPOF** | Vercel + Neon + Upstash + Supabase + GHA | 계정·한도·콜드스타트·장애 지점 5곳 |
| **VibeQuant와 이원화** | cassandra = Vercel Next, VibeQuant = CF Pages/Workers | 브랜드·인프라·데이터 파이프라인 중복 |

목표: **$0/월 유지** + **수집은 배치(아이맥/GHA)**, **서빙은 Cloudflare**, **제품은 VibeQuant.cc 서브도메인**.

---

## 1. 목표 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  VibeQuant.cc (Cloudflare DNS)                                  │
│  lab.vibequant.cc  →  CASSANDRA UI (Pages)                      │
│  api.vibequant.cc  →  공유 Worker (시세·캐시·auth 게이트)         │
└────────────┬────────────────────────────┬───────────────────────┘
             │ 읽기                        │ 쓰기(배치만)
             ▼                            ▼
      ┌─────────────┐              ┌──────────────────┐
      │ D1 / R2 / KV│◄─ sync ─────│ Batch Ingest     │
      │ (서빙 전용)  │              │ · Idle iMac cron │
      └─────────────┘              │ · GHA (저빈도)   │
                                   │ · DART 15k/일    │
                                   └──────────────────┘
```

### 역할 분리 (무료 티어 핵심)

| 계층 | 담당 | 하지 않는 것 |
|------|------|-------------|
| **Cloudflare Pages** | 정적/CSR UI (`/quant` `/trump` `/spacex` `/saju` → 관계망) | 장시간 DART 크롤 |
| **Workers + Cron** | 짧은 API, 캐시 히트, 헬스체크 (CPU 10ms 주의) | 대량 백필·Puppeteer |
| **D1 + R2 + KV** | 관계·시그널 메타(D1), JSON/공시 스냅샷(R2), TTL 캐시(KV) | Neon/Upstash 대체 |
| **Batch (iMac / GHA)** | DART list·상세 API·임원·인명 정규화·관계 백필 | 사용자 트래픽 서빙 |
| **Supabase Auth** | 당분간 유지 (OAuth). 이후 CF Access 또는 자체 JWT 검토 | DB로 쓰지 않음 |

### 멀티 SaaS 축소

| 현행 | 이후 | 비고 |
|------|------|------|
| Vercel Hobby | **CF Pages + Workers** | 단일 배포·DNS |
| Neon PG | **D1** (관계·유저 메타) + **R2** (공시 JSON) | Prisma→Drizzle |
| Upstash Redis | **Workers KV** (+ Cache API) | 캐시 전용 |
| Supabase Auth | **1단계 유지**, 2단계 CF Access/자체 세션 | Auth만 남김 |
| GHA 크롤러 6종 | **iMac launchd/cron 주력** + GHA는 백업·저빈도 | DART rate limit 준수 |
| GitHub `data/*.json` CDN | **R2** | 빈 `[]` 커밋 방지 게이트 |

---

## 2. 데이터 수집 전략 (고빈도 vs 무료 티어)

DART OpenAPI **15,000건/일**. Vercel/Workers 안에서 돌리면 CPU·타임아웃·한도에 걸림 → **수집과 서빙 분리**.

### 권장: Idle iMac = Ingest Node

```
iMac (상시 켜둔 배치 머신)
  launchd / cron
    06:00  corp_code 갱신 (주 1회면 충분)
    09:05  당일 신규 공시 list.json (증분)
    09:30  시그널 룰셋 8종 + anomaly report
    12:00  임원/주요주주 구조화 API (majorstock, exctvSttus) — 청크
    18:05  2차 증분 + personUid 정규화 / SameNameGroup
    22:00  본문/XBRL·NER 백필 (저우선, 남은 쿼터)

산출물 → R2 (또는 git push는 "0건이면 fail") → Worker가 읽기만
```

| 옵션 | 적합 시점 | 한계 |
|------|-----------|------|
| **Idle iMac (1순위)** | 일·시간 단위 공시/인명 | 집 네트워크·전원 의존 → health ping 필요 |
| **GitHub Actions** | 공개 레포, 하루 2회 이하 | 분 단위 고빈도·장시간 job 부적합 |
| **다른 무료 SaaS** (Railway trial, Render free, OCI Always Free) | iMac 불가 시 백업 워커 | 슬립·콜드·egress 제한 — **서빙용이 아니라 ingest 전용** |
| **Workers Cron** | 헬스체크, “오늘 스냅샷 있나?” 검증 | 대량 DART 루프 금지 (10ms CPU) |

**원칙:** 고빈도(장중 수분마다)가 필요하면 iMac/OCI. Cloudflare는 **이미 모은 데이터 서빙**만.

### 인명 매칭 복구 (관계망 선행 조건)

1. `makePersonUid(name, birthDate)` 단일 규칙 (`src/lib/person-uid.ts`) — 모든 수집 경로 통일  
2. 제목 regex 폐기 → `majorstock` / `exctvSttus` 등 **구조화 API** 우선  
3. `SameNameGroup` 자동 병합 배치 (생년월일 없으면 `unverified`)  
4. Fund/조합은 `fund-builder`로 법인 키워드 분기 후 엣지 생성  
상세: [REFACTORING_PLAN.md](REFACTORING_PLAN.md) Phase 1–2

---

## 3. 이전 순서 (제품 단위)

> **읽기 위주·외부 시세 의존 페이지부터** CF로 옮기고, **DART·인명·관계망은 데이터 파이프라인 복구 후** 마지막에 옮긴다.

| Phase | 제품 | 경로 | 이유 |
|-------|------|------|------|
| **M1** | 퀀트 대시보드 | `/quant` (+ TQQQ 일부) | Yahoo/시세 캐시 중심, DART 비의존, VibeQuant 본업과 직결 |
| **M2** | Trump Pick | `/trump` | RSS+LLM+KV 캐시, 수집량 작음 |
| **M3** | SpaceX | `/spacex` | 기존 GHA와 유사 패턴, 뉴스 폴백 |
| **M4** | 주식 사주 | `/saju` | 순수 계산+가벼운 API, 레이트리밋만 Workers/KV로 |
| **M5** | 관계망·코스닥·인명 | `/` `/dashboard` `/wiki` `/person-search` | **DART 복구 + personUid + 백필 완료 후** |

각 Phase 공통 체크리스트:

- [ ] Pages 라우트 또는 Worker 핸들러 동작
- [ ] KV/R2 캐시 히트 확인
- [ ] Supabase 세션(또는 공개) 동작
- [ ] `lab.vibequant.cc/...` DNS + CORS
- [ ] 구 Vercel 경로 리다이렉트(또는 병행)

---

## 4. 단계별 실행 계획

### Phase A — 안정화 (이전 전, 1주)

필수. Cloudflare로 옮기기 전에 **빈 데이터·보안**부터.

- [ ] KOSDAQ 파이프라인 복구 (`extract-kosdaq` 0건 원인) + **0건이면 CI fail**
- [ ] API `requireUser` / `requireExpert` + LLM 레이트리밋
- [ ] DeepSeek URL/`deepseek` 클라이언트 단일화
- [ ] personUid 전 경로 통일 + officers/crawl dry-run
- [ ] iMac(또는 OCI) ingest PoC: 하루 증분 → R2/로컬 JSON

### Phase B — VibeQuant 통합 골격 (3~5일)

- [ ] `lab.vibequant.cc` (또는 `cassandra.vibequant.cc`) Pages 프로젝트
- [ ] 공유 `api.vibequant.cc` Worker에 CASSANDRA 네임스페이스 (`/cassandra/*`)
- [ ] 환경변수·시크릿: DART/Toss/DeepSeek는 **ingest 머신 + Worker secrets**만 (Pages에 넣지 않음)
- [ ] README/네비에 VibeQuant 브랜드·크로스링크

### Phase C — M1→M4 제품 이전 (우선순위 순)

1. Quant → 2. Trump → 3. SpaceX → 4. Saju  
각 완료 시 Vercel 해당 라우트는 CF로 301 또는 피처 플래그.

### Phase D — 관계망·DART (M5)

- [ ] iMac 배치로 구조화 API + 백필 → D1/R2 적재
- [ ] 그래프 API를 Worker+D1으로
- [ ] Neon 읽기 제거 → D1 only
- [ ] Upstash 제거 → KV only
- [ ] Vercel 프로젝트 롤백용 보관 후 DNS 컷오버

### Phase E — 폐기·문서

- [ ] Neon/Upstash 다운스케일
- [ ] TECH_STACK / REFRESH_POLICY / ROADMAP 동기화
- [ ] vibe-investing `CASSANDRA AI/` 또는 submodule 정리 방침 결정

---

## 5. 무료 티어 예산 가이드

| 리소스 | Free 한도 (대략) | CASSANDRA 사용 방침 |
|--------|------------------|---------------------|
| Workers req | 100k/일 | 캐시 우선, 대시보드 SSR 최소화 |
| Workers CPU | 10ms/요청 (무료) | 무거운 파싱은 배치로 |
| D1 | 5GB / 5M row read | 관계·시그널만; 공시 본문은 R2 |
| KV | 1GB | TTL 캐시 (quant/trump/saju) |
| R2 | 10GB/월 class A 제한 유의 | `kosdaq-*.json`, corp 스냅샷 |
| DART | 15,000/일 | 증분 우선, 백필은 쿼터 남는 야간 |
| GHA | 공개 레포 관대 | 백업 동기화만, 빈 커밋 금지 |

**단일 장애점 완화:** 서빙=Cloudflare, 수집=iMac(+GHA 백업). Auth만 Supabase에 잠시 남는 구조가 최선 타협.

---

## 6. 성공 기준

| 지표 | 기준 |
|------|------|
| KOSDAQ anomaly | `totalStocks > 0`, CB/소송/대주주 등 non-empty |
| 인명 검색 | 동일인 단일 `personUid`, 1-hop 인물 노드 표시 |
| 배포 | `lab.vibequant.cc` 에서 M1–M4 200 |
| 비용 | 월 $0 (유료 전환 트리거 없음) |
| SPOF | 장애 시 서빙(CF)과 수집(iMac) 독립 — 수집 멈춰도 전일 R2 스냅샷 서빙 |

---

## 7. 작업 방식 (관계망·리팩토링)

오류를 줄이기 위해 **계획 → 소스 분석 → 순차 적용**을 지킨다.

1. 본 문서 + [REFACTORING_PLAN.md](REFACTORING_PLAN.md)로 범위·순서 고정  
2. 관계망·인명 경로는 DeepSeek V4 Pro / Claude와 **코드 리뷰·원인 가설**을 맞춘 뒤 패치  
3. 제품 컷오버는 **Quant → Trump → SpaceX → 사주**만 선행; 관계망(M5)은 DART·`personUid` 복구 후  
4. 한 번에 인프라+제품+수집을 바꾸지 않음 — Phase A 안정화 게이트를 통과한 뒤에만 B~

---

## 8. 비범위 / 나중에

- Next.js 전체를 Workers에서 SSR 유지 (가능하면 OpenNext, 아니면 API+CSR 분리)
- Supabase Auth 완전 제거 (M5 이후)
- Truth Social 유료 API, 다중 LLM 앙상블
- vibe-investing 모노레포로 코드 물리 병합 (서브도메인·API 공유만으로도 Phase B 충분)
