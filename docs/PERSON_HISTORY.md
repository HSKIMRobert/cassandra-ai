# 인물 이력 자동 수집 시나리오

## 개요

코스닥 기업의 대표, 이사, 주요 주주 정보를 DART 지분공시(D-type)에서
매일 1~2회 자동 수집하여 GitHub + Redis + DB에 저장.
중복 제거, 선임/사임 이력 관리, 생년월일 정규화.

## 데이터 흐름

```
GitHub Actions (매일 06:00 / 18:00 KST)
  │
  ├─ 1. DART 지분공시(D-type) 전체 수집
  │     └─ list.json?pblntf_ty=D&corp_cls=K (3개월)
  │     └─ 11,000+건/3개월 → 일일 신규 100~300건
  │
  ├─ 2. 인물명 + 생년월일 추출
  │     └─ flr_nm (제출인명) 파싱
  │     └─ report_nm 에서 역할 정보 추출
  │     └─ "임원ㆍ주요주주특정증권등소유상황보고서"
  │     └─ "주식등의대량보유상황보고서"
  │
  ├─ 3. 중복 제거 (name + birthDate)
  │     └─ 동일 이름+생년월일 → 단일 Person 레코드
  │     └─ 다른 생년월일 → 별도 Person (동명이인)
  │
  ├─ 4. 이력 관리 (PersonHistory)
  │     └─ 회사명, 역할(대표/이사/주주), 시작일, 종료일
  │     └─ "사임" 키워드 감지 → 종료일 기록
  │
  ├─ 5. 저장
  │     ├─ DB: Person + PersonHistory + CorpPersonRelation
  │     ├─ GitHub: Dart_Data/person-history/{날짜}.json
  │     └─ Redis: person:history:{name} (72시간 캐시)
  │
  └─ 6. 인물 검색 API 연동
        └─ GET /api/person-search → DB Person + PersonHistory
```

## DB 모델

```
PersonHistory {
  id: string
  personId: string (FK → Person)
  personUid: string
  companyName: string
  stockCode: string
  role: string           // "대표이사" | "사내이사" | "사외이사" | "주요주주"
  eventType: string      // "APPOINTED" | "RESIGNED" | "HOLDING"
  eventDate: DateTime
  sourceRceptNo: string  // DART 접수번호
  createdAt: DateTime
}
```

## GitHub Actions 워크플로우

```yaml
name: Daily Person History Sync
on:
  schedule:
    - cron: "21 0 * * *"   # 09:21 KST
    - cron: "21 9 * * *"   # 18:21 KST
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install && npx prisma generate
      - run: npx tsx scripts/sync-person-history.ts
        env:
          DATABASE_URL: ${{ vars.DATABASE_URL }}
          DART_API_KEY: ${{ vars.DART_API_KEY }}
      - run: |
          git config user.name "github-actions"
          git add Dart_Data/
          git diff --staged --quiet || git commit -m "chore: person history sync"
          git push
```

## 예상 데이터 규모

| 항목 | 예상치 |
|---|---|
| 일일 신규 인물 | 100~300명 |
| 일일 이력 이벤트 | 200~500건 |
| 누적 인물 (1년) | 5,000~10,000명 |
| GitHub 저장 크기 | 10~50MB |
| DB 크기 | 20~100MB |

## 장점

- DART 공시 기반 → 100% 신뢰성
- 하루 1~2회 → 24시간 내 모든 변동 커버
- 생년월일 기반 중복 제거 → 동명이인 구분
- 선임/사임 이력 → 개인별 커리어 타임라인
- GitHub + Redis + DB 3중 저장 → 무중단
