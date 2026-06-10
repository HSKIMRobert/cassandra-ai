# CASSANDRA AI

> **Toss × DART × LLM 리스크 모니터링**
>
> 코스닥 1,822개 종목 DART 공시 실시간 분석 + 주식셀럽 관계망
>
> **$0/월 완전 무료 운영** — Vercel + Neon + Upstash + GitHub Actions

---

## 핵심 아이디어

**GitHub 레포지토리를 무료 JSON 스토리지 + CDN으로 활용**하여 $0 인프라를 구축했습니다.
서버리스 아키텍처로 트래픽이 없을 땐 비용이 0이고, 늘어나도 무료 티어 내에서 운영됩니다.

```
인프라 비용: $0/월
├── Vercel Hobby      → 웹 호스팅 + API ($0)
├── Neon Free         → PostgreSQL 0.5GB ($0)
├── Upstash Redis Free → 캐시 256MB ($0)
├── GitHub Actions    → 크롤러/스크래퍼 (공개 레포 무제한)
└── GitHub Storage    → JSON 데이터 CDN (1GB 한도)
```

## 주요 기능

### 검색 + 관계망 분석
- 회사명·인물명·법인명 통합 검색 (3,920개 DART + DB 700개사)
- Cytoscape.js 관계망 (회사↔인물↔법인↔PersonHistory)
- 공시 분석 패널: 위험 신호·카테고리·타임라인
- 실시간 검색어 + 인물 검색 랭킹

### DART 분석 챗봇
- 4단계 검색: DB → DART API → 인물 → 실시간 폴백
- 9개 카테고리 분류 + 주요 신호 분석 텍스트
- 기간 선택 (1/3/6/12/24/36개월) + Redis 72시간 캐싱

### 경제 지표 대시보드
- Naver Finance 실시간 시총·거래량·등락률
- DART 12개월 실공시 + 8종 룰셋 + 일일 고위험 시그널
- 서버/Redis/DB 사용량 모니터

### 주식셀럽 WIKI + 인물 이력
- 10명 주요 투자자 정보 + 코멘트
- PersonHistory 500건 (DART 지분공시 기반)
- elestock 로테이션 (500개사/일 × 4일 = 전체 완주)

### 인프라 자동화
- GitHub Actions: 일 5회 자동 동기화
- 인물 검색: DB → DART API → GitHub Actions Puppeteer
- 제보 분석: 게시글 제출 시 자동 AI 분석 리포트

## 무료 티어 사용량

| 서비스 | 사용량 | 한도 |
|---|---|---|
| Neon DB | 4,223건 (3.4%) | 0.5GB |
| Redis | 1.5K commands | 500K/월 |
| Vercel | <1% | 1M func/월 |
| GitHub | <50MB | 1GB |

## 기술 스택

Next.js 15 + TypeScript · Neon PostgreSQL · Prisma 6 · Upstash Redis · React 19 · Tailwind CSS 4 · Cytoscape.js · GitHub Actions

## 실행

```bash
npm run dev          # 개발 서버
npm run daily        # 일일 공시 동기화
npm run person-sync  # 인물 이력
npm run logs         # 통계
```

## 문서

[docs/](docs/) — 서비스 흐름도, 배포 전략, 기술 스택, 검색 아키텍처, 인물 검색, 인물 이력

## 라이선스

공익 목적. 상업적 이용 제한.
