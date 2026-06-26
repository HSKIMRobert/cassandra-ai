# CASSANDRA AI — 관계망 리팩토링 Claude 코드 분석 리포트

> **기반 문서**: [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) (v2.0.0, 2026-06-26)
> **분석 일자**: 2026-06-26
> **최종 업데이트**: 2026-06-27
> **분석 대상**: 실제 소스코드 (graph-queries.ts / EntityGraph.tsx / analyze-cluster/route.ts / prisma/schema.prisma / redis-cache.ts)
> **목적**: 기존 5개 단절 진단에 코드 레벨 구현 버그·성능 이슈를 추가하고 수정 우선순위를 재정렬한다

---

## 요약: 기존 계획 평가

[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)의 5개 단절 진단은 **정확하다.**
특히 "Fund 생성 코드 0곳"(단절 3), "공시 본문 미파싱"(단절 4), "personUid 불일치"(단절 5)는
관계망이 비어 있는 직접적 원인으로, 3-Phase 리팩토링 구조도 타당하다.

다만 **기존 계획이 다루지 않은 구현 레벨 버그 9개**를 코드에서 추가 발견했다.
이 중 일부는 Phase 1~2 작업 후에도 관계망이 여전히 안 보일 수 있는 **독립적 블로커**다.

---

## 추가 발견 이슈 9개

### ✅ 이슈 A: BFS N+1 쿼리 → Vercel 10초 타임아웃 위험 **[완료]**

**파일**: `src/lib/graph-queries.ts`
**수정 커밋**: `82e4dec` (2026-06-27)

hop 단위 `Promise.all` 병렬 처리로 교체. 시리얼 serial await 제거.

```typescript
// ✅ 수정 완료: hop 단위 병렬 처리
await Promise.all(thisHop.map(async (item) => {
  await processCorpNode(item.id, ...);
}));
```

---

### ✅ 이슈 B: `CorpAuditRelation` 마이그레이션 미완료 **[완료]**

**파일**: `src/lib/graph-queries.ts`
**수정 커밋**: `82e4dec` (2026-06-27)

`(prisma as any)` 캐스트 제거 → `prisma.corpAuditRelation` 정식 사용.
`npx prisma generate` 실행으로 Prisma Client 재생성 완료.

---

### ✅ 이슈 C: `EntityGraph.tsx`의 corp 노드 탭 → 404 버그 **[완료]**

**파일**: `src/components/EntityGraph.tsx:65`, `src/components/PersonTimeline.tsx:99`
**수정 커밋**: `82e4dec` (2026-06-27)

```typescript
// ✅ 수정 완료
window.open(`/corp/${nd.corpCode || encodeURIComponent(nd.label)}`, "_blank");
```

`addCorpNode`에 `corpCode` 필드 추가, EntityGraph·PersonTimeline 양쪽 수정.
**검증 완료**: 회사 탭 클릭 → 404 없어짐 (사용자 확인)

---

### ✅ 이슈 D: 그래프 캐시 TTL = 144시간 → 신규 데이터 반영 지연 **[완료]**

**파일**: `src/app/api/graph/route.ts`
**수정 커밋**: `82e4dec` (2026-06-27)

```typescript
// ✅ 수정 완료
await setCache(cacheKey, result, 30 * 60); // 30분
```

---

### ✅ 이슈 E: Filing 표시 역설 — 관계 있는 회사는 공시가 안 보임 **[완료]**

**파일**: `src/lib/graph-queries.ts`
**수정 커밋**: `82e4dec` (2026-06-27)

`personRelations.length === 0` 역전 조건 제거. hop=0 시드 기업은 항상 공시 표시.

> **주의**: 공시 탭 미표시가 여전히 발생 중 → 원인 분석 결과, Filing 자체가 DB에 Corp와 연결되지 않음.
> `daily-sync.ts`가 `dart-corp-codes.json` 뒤쪽 200개만 처리해 DB Corp와 겹치지 않는 구조적 문제.
> **추가 수정**: `scripts/backfill-filings.ts` 생성 + GitHub Actions 일일 자동 실행 추가 (`2d22916`)

---

### 🟡 이슈 F: `analyze-cluster` 노드 임의 슬라이싱 → 고위험 노드 분석 누락 **[미완료]**

**파일**: `src/app/api/analyze-cluster/route.ts:34,38`

```typescript
// ❌ 현재: 순서 무관 slice
for (const cn of corpNodes.slice(0, 10)) { }
for (const pn of personNodes.slice(0, 5)) { }
```

**수정 방향**: 리스크 점수 기준 정렬 후 슬라이싱
```typescript
const priorityCorps = corpNodes
  .sort((a, b) => (b.data.signalCount ?? 0) - (a.data.signalCount ?? 0))
  .slice(0, 10);
```

---

### ✅ 이슈 G: `searchAll`의 OR 로직 — 복합 검색어 정확도 저하 **[완료]**

**파일**: `src/lib/graph-queries.ts`
**수정 커밋**: `82e4dec` (2026-06-27)

단일 토큰 → OR, 복합 토큰 → AND 방식으로 전환 완료.

---

### 🟡 이슈 H: 그래프 캐시와 분석 캐시 TTL 불일치 **[미완료]**

**파일**: `src/app/api/analyze-cluster/route.ts`

그래프 캐시는 30분으로 수정됐으나 `cluster-analysis:*` 캐시는 여전히 TTL 미설정 (144h).
그래프 갱신 시 분석 캐시 무효화 로직 없음.

**수정 방향**:
```typescript
await setCache(cacheKey, result, 30 * 60); // 분석 캐시도 30분
await redis.del(`cluster-analysis:${normalizedQ}`); // 그래프 갱신 시 무효화
```

---

### 🟡 이슈 I: `analyze-cluster` DeepSeek API URL — `/v1/` prefix 없음 **[미완료]**

**파일**: `src/app/api/analyze-cluster/route.ts:6`

```typescript
// ❌ 현재
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
// ✅ 수정 필요 (다른 route와 통일)
const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
```

---

## 진행 현황

| 우선순위 | 이슈 | 상태 | 커밋 |
|---|---|---|---|
| **P0** | 이슈 C: corp 노드 탭 404 | ✅ 완료 | `82e4dec` |
| **P0** | 이슈 E: Filing 역설 조건 | ✅ 완료 | `82e4dec` |
| **P0** | 이슈 B: CorpAuditRelation 누락 | ✅ 완료 | `82e4dec` |
| **P1** | 이슈 A: N+1 BFS 쿼리 | ✅ 완료 | `82e4dec` |
| **P1** | 이슈 D: 캐시 TTL 144h | ✅ 완료 | `82e4dec` |
| **P2** | 이슈 G: searchAll OR 로직 | ✅ 완료 | `82e4dec` |
| **P2** | 이슈 F: 분석 노드 슬라이싱 | 🟡 미완료 | — |
| **P3** | 이슈 H: 캐시 TTL 불일치 | 🟡 미완료 | — |
| **P3** | 이슈 I: DeepSeek URL 불일치 | 🟡 미완료 | — |

---

## Phase 실행 현황

```
✅ P0 핫픽스 (완료 — 2026-06-27)
   이슈 B·C·D·E + 이슈 A·G 동시 수정
        │
        ▼
✅ PHASE 1 — 스키마 정합성 복원 (완료 — 2026-06-27)
   CorpPersonRelation: isCurrent + @@unique([corpId, personId, role])
   PersonHistory: 스크립트 필드 정합
   중복 5105건 제거, isCurrent 1445건 백필
        │
        ▼
✅ PHASE 2 — 파서/빌더/백필 (완료 — 2026-06-27)
   dart-parsers.ts / fund-builder.ts / backfill-relations.ts
   backfill-filings.ts / backfill-marketcap.ts
   person-uid.ts / merge-samename.ts
   GitHub Actions 일일 백필 자동화
        │
        ▼
✅ PHASE 3 — 리스크 엔진 (완료 — 2026-06-27)
   risk-flags.ts (3레이어) / daily-sync.ts 통합
   backtest-riskflags.ts
        │
        ▼
🟡 PHASE 4 — 잔여 이슈 (예정)
   이슈 F: analyze-cluster 노드 우선순위 슬라이싱
   이슈 H: cluster-analysis 캐시 TTL + 무효화
   이슈 I: DeepSeek URL /v1/ 통일
   동명이인 관리자 UI (/admin/samename)
   WIKI 동명이인 배너
```

---

## 검증 체크리스트

**P0~Phase 3 완료 후 검증:**
- ✅ 회사 탭 클릭 → 404 없어짐 (사용자 확인 2026-06-27)
- ⬜ 공시 탭 데이터 표시 (backfill-filings 실행 후 확인 필요)
- ⬜ depth=3 검색 10초 내 완료
- ⬜ 백테스팅 TP율 측정 (`npx tsx scripts/backtest-riskflags.ts --days 365`)
- ⬜ 시총 5000억 이하 필터 적용 확인 (`backfill-marketcap.ts` 실행 후)

**Phase 4 예정:**
- ⬜ `analyze-cluster` 응답에서 고위험 노드 우선 포함 확인
- ⬜ 동명이인 관리자 UI 구현
- ⬜ WIKI 동명이인 배너 구현
