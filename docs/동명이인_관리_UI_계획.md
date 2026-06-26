# 동명이인 검토 UI 계획

## 배경

`merge-samename.ts`가 동명이인 `SameNameGroup`을 자동 감지하지만,
실제 "같은 사람인지 / 다른 사람인지"는 사람이 검토해야 합니다.
이를 위해 두 곳에 UI를 추가합니다.

---

## 1. 관리자 페이지 (`/admin/samename`)

### 역할
- SameNameGroup 목록 열람
- 각 그룹 내 Person 카드 비교 (이름, 생년월일, 소속 회사 이력)
- 판정: **동일인 확정** → Person 병합 / **다른 사람** → 그룹 분리 표시

### 화면 구성

```
/admin/samename
┌─────────────────────────────────────────────┐
│ 동명이인 그룹 (총 N개)       [미검토만 보기] │
├─────────────────────────────────────────────┤
│ 김철수 (3명)                [검토하기 ▶]    │
│ 이영희 (2명)   ✅ 동일인 확정              │
│ 박민준 (4명)   ❌ 다른 사람               │
└─────────────────────────────────────────────┘

[검토 모달]
┌──────────────────┬───────────────────────────┐
│ Person A          │ Person B                  │
│ 김철수            │ 김철수                    │
│ 생년: 1965-03-11  │ 생년: 미상                │
│ CEO: 한국기업(주) │ 이사: 엠투엔(주)          │
│ 이사: ABC홀딩스   │ 감사: 제이에스링크        │
└──────────────────┴───────────────────────────┘
[동일인 확정 — 병합]  [다른 사람 — 분리]  [보류]
```

### API 설계

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/admin/samename` | SameNameGroup 목록 (페이지네이션) |
| GET | `/api/admin/samename/[id]` | 그룹 상세 + 각 Person의 관계 목록 |
| POST | `/api/admin/samename/[id]/merge` | 동일인 확정 → personIds[0]에 나머지 병합 |
| POST | `/api/admin/samename/[id]/split` | 다른 사람 → 그룹에 `resolved: false` 마킹 |

### 병합 로직 (`merge` 액션)
1. `personIds[1..]`의 `CorpPersonRelation`을 `personIds[0]`으로 이전
2. `personIds[1..]` Person 레코드 soft-delete (`deletedAt` 마킹)
3. `SameNameGroup.resolved = true` 저장
4. 그래프 캐시 무효화 (`graph:*` Redis 키 삭제)

---

## 2. WIKI 인물 페이지 (`/wiki/person/[uid]`)

### 역할
- 인물 검색 결과에서 "동명이인이 있습니다" 배너 표시
- 일반 사용자가 제보 가능 (관리자가 최종 판정)

### 화면 구성

```
/wiki/person/김철수_1965-03-11

┌─────────────────────────────────────────────┐
│ 김철수                                       │
│ ⚠️ 동명이인 2명이 감지됐습니다              │
│    [다른 김철수 보기] [관리자에게 제보]      │
├─────────────────────────────────────────────┤
│ 소속 회사 타임라인                           │
│  2019~ CEO: 한국기업(주)                    │
│  2015~2018 이사: ABC홀딩스                  │
└─────────────────────────────────────────────┘
```

### 구현 포인트
- `getPersonTimeline(personId)` 호출 시 `SameNameGroup` 동시 조회
- `SameNameGroup.resolved !== true` 인 경우에만 배너 표시
- "다른 김철수 보기" → 같은 이름의 다른 Person 목록 모달

---

## 구현 순서

### Step 1 — 스키마 보강 (1일)
```prisma
model SameNameGroup {
  // 기존 필드...
  resolved    Boolean  @default(false)   // 추가: 검토 완료 여부
  resolvedAt  DateTime?                  // 추가: 완료 일시
  resolvedBy  String?                    // 추가: 관리자 ID
  verdict     String?  // "SAME" | "DIFFERENT" | "PENDING"
}

model Person {
  // 기존 필드...
  deletedAt   DateTime?   // 추가: 병합으로 제거된 Person soft-delete
  mergedInto  String?     // 추가: 병합된 경우 대상 Person ID
}
```

### Step 2 — API (2일)
- `/api/admin/samename/route.ts` — 목록
- `/api/admin/samename/[id]/route.ts` — 상세 + merge/split 액션

### Step 3 — 관리자 UI (2일)
- `/app/admin/samename/page.tsx` — 목록 + 필터
- `/app/admin/samename/[id]/page.tsx` — 비교 카드 + 판정 버튼

### Step 4 — WIKI 배너 (1일)
- `/app/wiki/person/[uid]/page.tsx` — 동명이인 배너 추가

---

## 우선순위
- **즉시**: Step 1 스키마 보강 (다른 작업에 영향 없음)
- **다음 스프린트**: Step 2-3 관리자 UI
- **이후**: Step 4 WIKI 배너
