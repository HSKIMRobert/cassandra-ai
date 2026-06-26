# CASSANDRA AI — 작업 히스토리

> 최종 업데이트: 2026-06-27

---

## v0.8 — 리팩토링 + 파이프라인 복구 (2026-06-27)

### P0 핫픽스 (`fix(graph)`)
| 버그 | 원인 | 수정 |
|------|------|------|
| 관계망 회사 탭 클릭 → 404 | `addCorpNode`에 `corpCode` 누락 | `corpCode` 필드 추가, `EntityGraph`/`PersonTimeline` 라우팅 수정 |
| 공시 탭 미표시 | filing 조건 역전 (`personRelations.length===0` 일 때만 표시) | 조건 제거 — hop=0 시드 기업 항상 표시 |
| `CorpAuditRelation` 접근 오류 | `(prisma as any)` 캐스트 | `prisma generate` 후 정식 모델 사용 |
| BFS 타임아웃 | 시리얼 `await` N+1 패턴 | hop 단위 `Promise.all` 병렬 처리 |
| 그래프 캐시 144h | `setCache` TTL 인자 누락 | 30분으로 단축 |

### Phase 1 — 스키마 정합
- `CorpPersonRelation`: `isCurrent Boolean` 필드 추가, `@@unique([corpId, personId, role])` 중복 방지
- 기존 중복 5105건 제거 (860개 그룹), `isCurrent=true` 1445건 백필
- `PersonHistory`: 스크립트 실제 사용 필드 반영 (`eventType`, `eventDate`, `personUid`, `sourceRceptNo` 등)

### Phase 2 — 파서/빌더 라이브러리
- `src/lib/dart-parsers.ts`: DART API 파서 (`fetchOfficers`, `fetchMajorShareholders`, `fetchAuditOpinion`, `fetchRecentFilings`)
- `src/lib/fund-builder.ts`: 법인 주주 감지(`isFundEntity`) → Fund 노드 + CorpFundRelation 자동 생성
- `scripts/backfill-relations.ts`: DB Corp 기준 임원/주주/감사 관계망 백필

### Phase 3 — 리스크 엔진
- `src/lib/risk-flags.ts`: 3레이어 리스크 평가
  - Layer 1: 공시 제목 패턴 10종 룰셋
  - Layer 2: 관계망 기반 (비적정감사의견, 소형회계법인, 다중겸직)
  - Layer 3: 복합신호 (3개 이상 룰 동시 발화)
- `scripts/daily-sync.ts`: 인라인 RULES → `risk-flags` 통합

### 유틸 / 자동화
- `src/lib/person-uid.ts`: personUid 표준 포맷 통합 (기존 5가지 패턴 → 1개)
- `scripts/merge-samename.ts`: 동명이인 SameNameGroup 자동 감지
- `scripts/backfill-filings.ts`: DB Corp 기준 공시 역방향 백필
- `.github/workflows/daily-sync.yml`: `backfill-filings` + `backfill-relations` 일일 자동 실행 추가

---

## v0.7 — Toss API 전환 + 인프라 (2026-06-24)

- **Naver Finance → Toss 증권 Open API**: `/api/quant-data`, `naver-crawler.ts`, `extract-kosdaq.ts` 전환
- **Node.js 20 → 24**: GitHub Actions 5개 워크플로우 전체 업그레이드
- **KOSDAQ 갱신 파이프라인 복구**: `extract-kosdaq.ts`를 `daily-sync.yml`에 추가 (17일 공백 해소)
- **GitHub repo vars**: `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET` 추가

---

## v0.6 — 서학개미 퀀트 + WIKI 통합 (2026-06-23)

- `/api/seohak`: Yahoo Finance(가격) + DeepSeek V3(분석) 서학개미 전략 API
- `/quant` 페이지: 서학개미 섹션 추가 (Koreans_Love_stock v2 전략 기반)
- Trump Pick + WIKI 인명검색 통합

---

## 현재 인프라 상태

| 항목 | 상태 |
|------|------|
| DB | Neon PostgreSQL (1079개 Corp, 999건 Filing, ~5000개 CorpPersonRelation) |
| 캐시 | Upstash Redis (그래프 30min, quant 72h, seohak 1h) |
| 배포 | Vercel (dart-monitor-pi.vercel.app) |
| 파이프라인 | GitHub Actions 매일 09:00/18:00 KST |
| 외부 API | DART, Toss 증권, Yahoo Finance, DeepSeek V3 |
