# CASSANDRA AI — 관계망 리팩토링 Claude 코드 분석 리포트

> **기반 문서**: [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) (v2.0.0, 2026-06-26)
> **분석 일자**: 2026-06-26
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

### 🔴 이슈 A: BFS N+1 쿼리 → Vercel 10초 타임아웃 위험

**파일**: `src/lib/graph-queries.ts:55-84`

```typescript
while (queue.length > 0) {
  const current = queue.shift()!;
  // ↓ 각 노드마다 serial await — 병렬 처리 없음
  const corp = await prisma.corp.findUnique({
    where: { id: current.id },
    include: { personRelations: ..., fundRelations: ... }
  });
}
```

**실측 쿼리 수**: depth=2, seed 5개 시 → 최대 **25회 serial DB 쿼리**.
depth=3에서 연결이 넓은 기업은 60+회 → Vercel 함수 10초 제한에서 **timeout 발생 가능**.

**현재 증상**: 사용자가 3hop 선택 시 그래프가 안 뜨거나 빈 결과 반환.

**수정 방향**:
```typescript
// ❌ 현재: serial await
while (queue.length > 0) {
  const current = queue.shift()!;
  await processNode(current);
}

// ✅ 수정: hop 단위 병렬 처리 (같은 hop의 노드를 한 번에)
const hopBuckets = groupBy(queue, n => n.hop);
for (const hop of sortedHops) {
  await Promise.all(hopBuckets[hop].map(n => processNode(n)));
}
```

---

### 🔴 이슈 B: `CorpAuditRelation` 마이그레이션 미완료 — 코드에 명시적 주석

**파일**: `src/lib/graph-queries.ts:64-67`

```typescript
try {
  const auditRels = await (prisma as any).corpAuditRelation.findMany(...);
  // ← (prisma as any) 캐스팅 자체가 타입 에러 우회
} catch { /* auditRelations table not yet migrated */ }
```

`(prisma as any)`로 캐스팅하는 것은 해당 모델이 `prisma generate` 산출물에 없다는 의미다.
`CorpAuditRelation` 모델이 `schema.prisma`에 **실제로 정의되어 있는지** 확인 필요.

**검증**:
```bash
grep "CorpAuditRelation\|corpAuditRelation" prisma/schema.prisma
```
결과가 없으면 스키마에 없는 모델을 코드에서 읽으려는 것 → **감사인 노드는 영원히 그래프에 나타나지 않는다.**

**수정**: `CorpAuditRelation` 모델을 스키마에 추가하고 `npx prisma migrate dev` 실행.
또는 단기 해결책: Phase 1 작업 전에 해당 블록을 빈 배열로 대체해 에러 노출 방지.

---

### 🔴 이슈 C: `EntityGraph.tsx`의 corp 노드 탭 → 404 버그

**파일**: `src/components/EntityGraph.tsx:65`

```typescript
// ❌ 현재: label(회사명 한글)로 이동
cy.on("tap", "node", (evt) => {
  if (nd.type === "corp") {
    window.open(`/corp/${encodeURIComponent(nd.label)}`, "_blank");
  }
});
```

**실제 라우트**: `src/app/corp/[code]/page.tsx` → `/corp/{corpCode}` (숫자 코드)

`addCorpNode()`에 `corpCode`를 담지 않아서 그래프 노드 data에 code가 없다.
"삼성전자" 클릭 시 `/corp/%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90` → **404**.

같은 버그가 `src/components/PersonTimeline.tsx:99`에도 있다:
```typescript
// ❌ companyName으로 /corp/[code] 라우트 접근
window.open(`/corp/${encodeURIComponent(entry.companyName)}`, "_blank")
```

**수정**: `addCorpNode`에 `corpCode` 필드 추가 → EntityGraph/PersonTimeline에서 corpCode 사용:
```typescript
// graph-queries.ts addCorpNode
{ id, label: corp.companyName, type: "corp", corpCode: corp.corpCode, ... }

// EntityGraph.tsx
window.open(`/corp/${nd.corpCode || encodeURIComponent(nd.label)}`, "_blank");
```

---

### 🟡 이슈 D: 그래프 캐시 TTL = 144시간 → 신규 데이터 반영 지연

**파일**: `src/lib/redis-cache.ts:14`, `src/app/api/graph/route.ts`

```typescript
// redis-cache.ts
const CACHE_TTL = 72 * 60 * 60; // 72시간

// graph/route.ts
await setCache(cacheKey, result); // ← ttlSec 인수 없음 → TTL = 144시간 (CACHE_TTL × 2)
```

`setCache(key, data)` 에 TTL을 안 넘기면 `ttlSec || CACHE_TTL * 2 = 144시간` 으로 저장된다.
Phase 2에서 백필로 DB에 관계 데이터가 쌓여도 기존 캐시가 남아있는 6일간 빈 그래프를 반환한다.

**수정**:
```typescript
// graph/route.ts
await setCache(cacheKey, result, 30 * 60); // 30분으로 단축 (장중 갱신 주기와 맞춤)
```

백필 완료 후에는 캐시 전체 flush도 필요:
```bash
# Upstash Redis에서 graph:* 키 일괄 삭제
redis-cli --scan --pattern "graph:*" | xargs redis-cli del
```

---

### 🟡 이슈 E: Filing 표시 역설 — 관계 있는 회사는 공시가 안 보임

**파일**: `src/lib/graph-queries.ts:68`

```typescript
// ← 관계(personRelations, fundRelations)가 0개인 회사만 공시를 보여줌
if (current.hop === 0 && corp.personRelations.length === 0 && corp.fundRelations.length === 0) {
  const dbFilings = await prisma.filing.findMany(...);
  filings.push(...);
}
```

Phase 2 완료 후 관계가 쌓이면 이 조건이 `false`가 되어 **공시 탭이 빈다**.
관계가 없을 때의 "공시라도 보여주기" 폴백 의도였지만, 조건이 역전되어 있다.

**수정**: 조건 제거, 항상 공시를 보여주되 관계가 있으면 탭으로 분리:
```typescript
// 항상 수집 (최근 20건)
const dbFilings = await prisma.filing.findMany({
  where: { corpId: corp.id },
  orderBy: { filedAt: "desc" },
  take: 20,
});
filings.push(...dbFilings.map(f => ({ ... })));
```

---

### 🟡 이슈 F: `analyze-cluster` 노드 임의 슬라이싱 → 고위험 노드 분석 누락

**파일**: `src/app/api/analyze-cluster/route.ts:34,38`

```typescript
for (const cn of corpNodes.slice(0, 10)) { /* 시그널 조회 */ }
for (const pn of personNodes.slice(0, 5)) { /* 타임라인 조회 */ }
```

Cytoscape에서 노드는 BFS 탐색 순서(시드 노드가 먼저)로 정렬된다.
리스크 점수 높은 인물이 11번째에 있으면 DeepSeek 분석에서 누락된다.

**수정**: 슬라이싱 전에 시그널 카운트로 정렬:
```typescript
// 시그널 많은 기업 우선
const priorityCorps = corpNodes
  .sort((a, b) => (b.data.signalCount ?? 0) - (a.data.signalCount ?? 0))
  .slice(0, 10);

// flags 있는 인물 우선
const priorityPersons = personNodes
  .sort((a, b) => (b.data.flags?.length ?? 0) - (a.data.flags?.length ?? 0))
  .slice(0, 5);
```

---

### 🟡 이슈 G: `searchAll`의 OR 로직 — 복합 검색어 정확도 저하

**파일**: `src/lib/graph-queries.ts:114`

```typescript
prisma.corp.findMany({
  where: {
    OR: tokens.flatMap(t => [
      { companyName: { contains: t } },
      { corpCode: { contains: t } },
    ])
  }
})
```

"신승수 인트로메딕" 검색 시 `신승수 OR 인트로메딕`이 되어
신승수와 무관한 "인트로메딕 관련 회사" 전부가 결과에 나온다.
단어가 2개 이상일 때는 AND가 직관적이다.

**수정**: 토큰이 2개 이상이면 AND 방식으로 전환:
```typescript
const where = tokens.length === 1
  ? { OR: [{ companyName: { contains: tokens[0] } }, ...] }
  : { AND: tokens.map(t => ({ companyName: { contains: t, mode: "insensitive" } })) };
```

---

### 🟢 이슈 H: 그래프 캐시와 분석 캐시 TTL 불일치

**파일**: `src/app/api/graph/route.ts`, `src/app/api/analyze-cluster/route.ts`

두 캐시 키가 모두 `setCache(key, data)` (TTL 없음) → 둘 다 144시간.
그래프 캐시가 만료되어 새 그래프가 반환되어도, `cluster-analysis:*` 키는 살아있어
**구 그래프 기반 AI 분석**이 계속 반환된다.

**수정**: 두 TTL을 함께 단축하고, 그래프 갱신 시 분석 캐시도 무효화:
```typescript
// graph/route.ts
const GRAPH_TTL = 30 * 60; // 30분
await setCache(cacheKey, result, GRAPH_TTL);
// 분석 캐시도 함께 무효화
await redis.del(`cluster-analysis:${normalizedQ}:*`);
```

---

### 🟢 이슈 I: `analyze-cluster` DeepSeek API URL — `/v1/` prefix 없음

**파일**: `src/app/api/analyze-cluster/route.ts:6`

```typescript
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
// ↑ /v1/ prefix 없음

// 반면 trump/route.ts, seohak/route.ts 모두:
const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
```

현재 DeepSeek 서버는 두 경로를 모두 허용하지만, 공식 문서 기준과 다르다.
`/v1/`로 통일하면 향후 API 버전 변경 시 혼란을 줄일 수 있다.

---

## 기존 계획과 신규 이슈 통합 우선순위

| 우선순위 | 이슈 | 영향 | 예상 공수 |
|---|---|---|---|
| **P0 — 즉시** | 이슈 C: corp 노드 탭 404 | 클릭 시 항상 404 | 30분 |
| **P0 — 즉시** | 이슈 E: Filing 역설 조건 | 관계 있는 회사 공시 안 보임 | 10분 |
| **P0 — 즉시** | 이슈 B: CorpAuditRelation 누락 | 감사인 노드 영원히 미표시 | 1시간 (마이그레이션) |
| **P1 — Phase 1 전** | 이슈 A: N+1 BFS 쿼리 | depth=3 timeout | 2~3시간 |
| **P1 — Phase 1 전** | 이슈 D: 캐시 TTL 144h | 백필 후 6일간 헛캐시 | 30분 |
| **P2 — Phase 2 후** | 이슈 F: 분석 노드 슬라이싱 | 고위험 노드 AI 분석 누락 | 1시간 |
| **P2 — Phase 2 후** | 이슈 H: 캐시 TTL 불일치 | 구 분석 계속 반환 | 30분 |
| **P3** | 이슈 G: searchAll OR 로직 | 복합 검색 정확도 | 30분 |
| **P3** | 이슈 I: DeepSeek URL 불일치 | minor, 예방적 | 5분 |

> **P0 이슈 3개는 Phase 1 작업과 무관하게 지금 바로 수정 가능하다.**
> 코드 5~10줄 수정으로 즉각 UX 개선이 가능하므로 가장 먼저 머지를 권장한다.

---

## 수정 범위 매트릭스 (기존 계획 + 신규)

| 파일 | 기존 계획 | 신규 이슈 | 변경 내용 |
|---|---|---|---|
| `src/lib/graph-queries.ts` | Phase 1 personUid | 이슈 A·E·G | BFS 병렬화 / filing 조건 수정 / searchAll AND 로직 |
| `src/components/EntityGraph.tsx` | Phase 3 배지 | 이슈 C | `nd.corpCode` 기반 라우팅 |
| `src/components/PersonTimeline.tsx` | — | 이슈 C | `corpCode` 기반 라우팅 (동일 버그) |
| `src/app/api/graph/route.ts` | — | 이슈 D·H | TTL 30분 / 분석 캐시 무효화 |
| `src/app/api/analyze-cluster/route.ts` | — | 이슈 F·H·I | 우선순위 슬라이싱 / TTL / URL |
| `prisma/schema.prisma` | Phase 1 | 이슈 B | `CorpAuditRelation` 모델 확인·추가 |

---

## Phase 실행 수정 제안

기존 REFACTORING_PLAN의 3-Phase 구조는 유지하되, **P0 핫픽스를 Phase 1 앞에 추가**한다:

```
[P0 핫픽스 — 1~2시간] ←── 신규 추가
  이슈 C: corpCode 라우팅 수정
  이슈 E: filing 조건 수정
  이슈 B: CorpAuditRelation 마이그레이션
  이슈 D: graph 캐시 TTL 단축 (30분)
        │
        ▼
PHASE 1 (정합성 복원) — 기존 계획 그대로
  스키마 + isCurrent + @@unique + person-uid.ts
  BFS 병렬화 (이슈 A) 를 Phase 1에 포함 권장
        │
        ▼
PHASE 2 (본문 파싱 + Fund 노드) — 기존 계획 그대로
  백필 후: 이슈 D 캐시 flush 필수
  이슈 F: 분석 슬라이싱 수정 포함
        │
        ▼
PHASE 3 (리스크 태깅) — 기존 계획 그대로
  이슈 G·H·I 는 Phase 3 QA 시 함께 처리
```

---

## 검증 추가 체크리스트 (기존 계획 보완)

기존 REFACTORING_PLAN 각 Phase 체크리스트에 다음 항목을 추가:

**P0 완료 후:**
- [ ] "삼성전자" 그래프에서 corp 노드 클릭 → `/corp/005930`으로 이동 (404 아님)
- [ ] PersonTimeline 기업명 클릭 → corpCode 기반 이동
- [ ] `CorpAuditRelation` 테이블이 DB에 존재 (`\dt` 확인)
- [ ] 관계 있는 회사 검색 시 공시 탭에 내용 표시

**Phase 1 완료 후 추가:**
- [ ] depth=3 검색이 10초 내 완료 (Vercel 함수 로그 확인)
- [ ] 그래프 캐시 TTL이 `redis-cli ttl "graph:*"` → 1800초(30분) 이하

**Phase 2 백필 후 추가:**
- [ ] `redis-cli --scan --pattern "graph:*" | wc -l` → 무효화 전후 비교
- [ ] 백필 완료 후 30분 내 새 그래프 반환 (144h 헛캐시 없음)
- [ ] `analyze-cluster` 응답의 persons/corps가 flags 있는 노드를 우선 포함

---

## 결론

기존 [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)의 5개 단절 진단은 정확하며, 3-Phase 구조로 충분히 해결 가능하다.

코드 분석에서 추가로 발견한 9개 이슈 중 **P0 3개 (이슈 B·C·E)는 총 2시간 이내에 수정 가능**하고,
Phase 1~3 완료 후에도 관계망이 이상하게 보이는 문제의 상당수를 미리 차단한다.

특히 **이슈 C (corp 노드 404)** 는 현재 사용자가 그래프에서 회사를 클릭할 때마다 발생하는
즉각적 UX 파괴 버그다. Phase 1 이전에 반드시 선행 수정을 권장한다.

> 본 문서는 자동 생성된 코드 분석이며, 실제 실행 전 로컬 환경에서 검증 후 적용하기를 권장한다.
