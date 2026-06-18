# CASSANDRA AI — 관계망 분석 기능 명세서

> 버전: v1.5.0 | 최종 업데이트: 2026-06-19

## 1. 개요

관계망 분석은 CASSANDRA AI의 핵심 기능으로, DART 공시 데이터를 기반으로
인물·기업·법인·감사인 간의 연결 구조를 그래프로 시각화하고,
작전세력의 구도 및 패턴을 식별합니다.

## 2. 노드 타입

| 타입 | 모양 | 색상 | 설명 |
|------|------|------|------|
| `corp` | 직사각형 | 보라 `#6c5ce7` | 상장사 (KOSDAQ/KOSPI) |
| `person` | 원 | 초록 `#00b894` | 자연인 (대표이사, 이사, 대주주 등) |
| `fund` | 다이아몬드 | 주황 `#f39c12` | SPC, 신기술조합, 투자조합 등 |
| `auditor` | 오각형 | 회색 `#636e72` | 감사법인, 법무법인, IR법인 |

- **빨간 테두리**: flags에 `suspicious` 또는 `blacklist` 포함
- **hop 불투명도**: hop=0 100% → hop=1 80% → hop=2 55%

## 3. 엣지 타입

| 타입 | 스타일 | 설명 |
|------|--------|------|
| `person_corp` | 실선 | 인물 ↔ 회사 (CEO, DIRECTOR 등) |
| `fund_corp` | 실선 | 법인 ↔ 회사 (CB_ACQUIRER 등) |
| `fund_person` | 점선 주황 | 인물 ↔ 법인 (BENEFICIAL_OWNER 등) |
| `audit_corp` | 점선 회색 | 감사인 ↔ 회사 (연도별 감사) |

## 4. buildDeepGraph — BFS 알고리즘

```
buildDeepGraph(query, depth=2)
  ├─ 시드 노드 탐색 (Corp / Person / Fund)
  ├─ BFS 큐 순회 (hop < depth 조건)
  │   ├─ Corp → PersonRelations + FundRelations + AuditRelations
  │   ├─ Person → CorpRelations + FundRelations
  │   └─ Fund → CorpRelations + PersonRelations
  ├─ 방문 중복 제거 (visited Set)
  ├─ hop 메타데이터 태깅
  └─ GraphData { nodes, edges, stats } 반환
```

### hop 깊이별 탐색 예시

```
1hop: 인트로메딕 → 신승수, 오종원, CBI인베스트먼트
2hop: 신승수 → 이엠앤아이, 티쓰리 / CBI → 코이엠앤아이
3hop: 이엠앤아이 → [추가 연결망]
```

## 5. PersonTimeline 컴포넌트

- 인물 기업 이력을 수평 타임라인 바로 시각화
- X축: 연도, Y축: 기업별 행
- 공시 시그널(CB발행·자본변동 등)을 해당 날짜에 마커로 오버레이
- 역할별 색상 구분 (CEO=빨강, DIRECTOR=보라, 감사=초록 등)

## 6. 감사인 네트워크 분석

```
AuditorFirm ──< CorpAuditRelation >── Corp
  - firmType: auditor | lawfirm | ir_firm
  - opinion: 적정 | 한정 | 부적정 | 의견거절
  - isSuspicious: 교체 패턴 감지
```

위험도 기준:
- HIGH: suspiciousCount ≥ 3 또는 비적정 ≥ 2
- MEDIUM: suspiciousCount ≥ 1 또는 비적정 ≥ 1

## 7. DeepSeek LLM 클러스터 분석

```
POST /api/analyze-cluster
{ query: string, depth: 1-3 }
```

DeepSeek v3(`deepseek-chat`)로 관계망 + 시그널 + 타임라인 종합 분석.
5개 섹션: 관계망 요약 / 위험 시그널 / 작전 패턴 / 핵심 역할 / 투자 주의.
캐시: Redis TTL 72h.

## 8. 백테스트 (`npm run backtest:network`)

`scripts/backtest-network.ts` — 측정 항목:
- hop 커버리지: 1→2→3hop 노드 수 증가율
- 감사인 위험도: HIGH/MEDIUM/LOW 분류
- 인물 의심도: 0~100점 (현직수×10 + 시그널기업수×15 + 관여기업수×5)
- CB 사이클: 발행 횟수 × 인물 중복 여부

결과: `Dart_Data/backtest-network-report.json`

## 9. API 엔드포인트

| 엔드포인트 | 메서드 | 파라미터 | 설명 |
|-----------|--------|----------|------|
| `/api/graph` | GET | `q`, `depth(1-3)`, `refresh` | 관계망 그래프 |
| `/api/analyze-cluster` | POST | `{ query, depth }` | LLM 작전세력 분석 |
| `/api/detail` | GET | `type`, `name`, `uid` | 노드 상세 (타임라인 포함) |
