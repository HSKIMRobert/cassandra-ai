# CASSANDRA AI — 작업 히스토리

> 최종 업데이트: 2026-06-27

---

## v0.8 — 리팩토링 + 파이프라인 복구 (2026-06-27)

### P0 핫픽스 (`82e4dec`)
| 버그 | 원인 | 수정 | 검증 |
|------|------|------|------|
| 관계망 회사 탭 클릭 → 404 | `addCorpNode`에 `corpCode` 누락 | `corpCode` 필드 추가, EntityGraph/PersonTimeline 라우팅 수정 | ✅ 사용자 확인 |
| 공시 탭 미표시 (조건 역전) | `personRelations.length===0` 일 때만 표시 | 조건 제거 — hop=0 항상 표시 | ✅ |
| CorpAuditRelation 접근 오류 | `(prisma as any)` 캐스트 | `prisma generate` 후 정식 모델 사용 | ✅ |
| BFS 타임아웃 위험 | 시리얼 `await` N+1 패턴 | hop 단위 `Promise.all` 병렬 처리 | ✅ |
| 그래프 캐시 144h | `setCache` TTL 인자 누락 | 30분으로 단축 | ✅ |
| 복합 검색어 정확도 저하 | searchAll OR 로직 | 복합 토큰 → AND 방식 | ✅ |

### Phase 1 — 스키마 정합 (`514cd30`)
- `CorpPersonRelation`: `isCurrent Boolean` 필드 추가, `@@unique([corpId, personId, role])` 중복 방지
- 기존 중복 5105건 제거 (860개 그룹), `isCurrent=true` 1445건 백필
- `PersonHistory`: 스크립트 실제 사용 필드 반영 (`eventType`, `eventDate`, `personUid`, `sourceRceptNo` 등)

### Phase 2 — 파서/빌더 라이브러리 (`e7e1b2e`)
- `src/lib/dart-parsers.ts`: DART API 파서 (`fetchOfficers`, `fetchMajorShareholders`, `fetchAuditOpinion`, `fetchRecentFilings`)
- `src/lib/fund-builder.ts`: 법인 주주 감지(`isFundEntity`) → Fund 노드 + CorpFundRelation 자동 생성
- `scripts/backfill-relations.ts`: DB Corp 기준 임원/주주/감사 관계망 백필 (`--cap-filter` 지원)

### Phase 3 — 리스크 엔진 (`69fce5e`)
- `src/lib/risk-flags.ts`: 3레이어 리스크 평가
  - Layer 1: 공시 제목 패턴 10종 룰셋
  - Layer 2: 관계망 기반 (비적정감사의견, 소형회계법인, 다중겸직)
  - Layer 3: 복합신호 (3개 이상 룰 동시 발화)
- `scripts/daily-sync.ts`: 인라인 RULES → `risk-flags` 통합

### 유틸 / 자동화 (`969bea4`, `2d22916`, `39894d0`)
- `src/lib/person-uid.ts`: personUid 표준 포맷 통합 (기존 5가지 패턴 → 1개)
- `scripts/merge-samename.ts`: 동명이인 SameNameGroup 자동 감지
- `scripts/backfill-filings.ts`: DB Corp 기준 공시 역방향 백필 (`--cap-filter` 지원)
- `scripts/backfill-marketcap.ts`: Toss API × DART 상장주식수 → Corp.marketCap 백필
- `scripts/backtest-riskflags.ts`: 룰셋 TP율 측정 — 신호 발화 후 후속 위험 공시 발생률
- `.github/workflows/daily-sync.yml`: 일일 백필 자동 실행 추가 (코스닥 5000억 이하 `--cap-filter`)
- `docs/동명이인_관리_UI_계획.md`: `/admin/samename` + WIKI 배너 4단계 구현 계획

### 남은 이슈 (Phase 4 예정)
| 이슈 | 파일 | 내용 |
|------|------|------|
| 이슈 F | `analyze-cluster/route.ts` | 노드 슬라이싱을 리스크 점수 기준 정렬로 변경 |
| 이슈 H | `analyze-cluster/route.ts` | cluster-analysis 캐시 TTL 30분 + 그래프 갱신 시 무효화 |
| 이슈 I | `analyze-cluster/route.ts` | DeepSeek URL `/v1/` prefix 통일 |
| 동명이인 UI | 신규 | `/admin/samename` 관리자 페이지 + WIKI 배너 |

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
| DB | Neon PostgreSQL (1079개 Corp, ~999건 Filing, ~5000개 CorpPersonRelation) |
| 캐시 | Upstash Redis (그래프 30min, quant 72h, seohak 1h) |
| 배포 | Vercel (dart-monitor-pi.vercel.app) |
| 파이프라인 | GitHub Actions 매일 09:00/18:00 KST — DART sync + Toss extract + backfill |
| 외부 API | DART, Toss 증권 (IP 화이트리스트 — GHA에서만 실행), Yahoo Finance, DeepSeek V3 |

---

## 스크립트 실행 가이드

```bash
cd /Users/dennis/dart-monitor

# 관계망 백필 (코스닥 5000억 이하)
npx tsx scripts/backfill-filings.ts --limit 200 --days 180 --cap-filter
npx tsx scripts/backfill-relations.ts --limit 100 --cap-filter

# 시총 백필 (GHA에서 실행 권장 — Toss IP 제한)
gh workflow run daily-sync.yml

# 동명이인 그룹화
npx tsx scripts/merge-samename.ts --dry-run
npx tsx scripts/merge-samename.ts

# 백테스팅
npx tsx scripts/backtest-riskflags.ts --days 365
```
