# CASSANDRA AI — 작업 로드맵

## 완료 (v0.7.0)

- [x] 관계망 그래프 (Cytoscape.js) + 통합 검색
- [x] 실시간 검색어 순위 (24시간)
- [x] 핀보드 + 리포트 (MD 다운로드)
- [x] 동명이인 생년월일 구분 (SameNameGroup)
- [x] BAD ASS / Good 투표 + 댓글
- [x] 제보·분석요청 게시판
- [x] CB 신호 6종 자동 탐지
- [x] 법인명 변경 추적 (CorpEvent)
- [x] 경제 지표 대시보드 (Naver 모바일 API)
- [x] 코스닥 100종목 추출 + JSON 데이터
- [x] 3,920개 상장사 DART corp_code 매핑
- [x] 로그인 + 세션 (JWT + bcrypt)
- [x] 챗봇 DART 분석 (4단계 검색)
- [x] 공시 분석 패널 (위험 신호 + 카테고리)
- [x] WIKI — 주식셀럽 (10명 + 코멘트)
- [x] DART 지식베이스 (사명변경·대주주·소송 82건)
- [x] 시총 하위 200개사 3개월 공시 캐싱
- [x] 일일 공시 동기화 (`npm run daily` + 8종 룰셋)
- [x] 대시보드 고위험 시그널 테이블
- [x] DB: 700개사, 2,523건 공시
- [x] Vercel + Neon 배포 ($0/월)
- [x] 인물 이력 자동 수집 (PersonHistory + DART D-type)
- [x] elestock.json 로테이션 (500개사/일)
- [x] 배치 분석 시스템 (게시판 + GitHub Actions)
- [x] 인물 검색 진행 로그 + 5초 타임아웃
- [x] 중복 노드/관계 정리 (528건 관계, 8개사 중복)
- [x] 관계망 테스트: 90% 통과 (100개 대시보드 기업)
- [x] 사용 설명서 (USER_GUIDE.md)

### 퀀트 대시보드 (2026-06-13)
- [x] `/quant` 비로그인 페이지 (ARDS-X · AMQS · ARDS)
- [x] Naver Finance 실시간 데이터 연동
- [x] 시장 게이지 (공포·중립·과열) + 개별 종목 시그널
- [x] TypeScript 퀀트 포팅 (`lib/quant-calc.ts`)
- [x] Redis 10분 캐시 + 새로고침 강제 갱신
- [x] 백테스트 방법론 (`docs/QUANT_BACKTEST.md`)
- [x] 섹터별 공포·탐욕 지수 (Yahoo Finance × 10 ETF × 5시그널)

### 보안 강화 (2026-06-13)
- [x] 페이지뷰 Redis 캐시 + Prisma(Neon DB) 영구 저장
- [x] Path Traversal 취약점 패치 (person-search 2건)
- [x] 전체 코드 XSS/SQL Injection 감사 통과
- [x] API 키·비밀번호 gitignored 검증 완료

### 인프라
- [x] Upstash Redis 연동 (검색·그래프·챗봇·페이지뷰·퀀트)
- [ ] CDN 캐싱 레이어
- [ ] OCI Always Free 크롤러 서버

## 진행 중

### 데이터 확장
- [ ] 전체 코스닥 상시 공시 캐싱
- [ ] DART dsab007 인물명 검색 파이프라인
- [ ] 공시-뉴스 크로스레퍼런스

### LLM 파이프라인
- [ ] DeepSeek V3 NER (개체명 인식) 연동
- [ ] Claude Fable 5 이상 패턴 분석
- [ ] 다중 LLM 앙상블 → 신호 발화
- [ ] 주식셀럽 → 시스템 프롬프트 주입

### 보안
- [ ] Board 비밀번호 SHA-256 → bcrypt 마이그레이션
- [ ] Cookie `__Secure-` prefix 적용

## 가설

> 회사명 변경 + 사업목적 추가 + 소송/경영권 분쟁 + 대주주 변경 →
> 주가 변동성 증가 및 CB/BW 자금조달 패턴 발생
