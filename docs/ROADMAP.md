# CASSANDRA AI — 작업 로드맵

## 완료 (v0.5.0)

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
- [x] DB: 541개사, 2,630건 공시
- [x] Vercel + Neon 배포 ($0/월)

## 진행 중

### 데이터 확장
- [ ] 전체 코스닥 상시 공시 캐싱
- [ ] DART dsab007 인물명 검색 파이프라인
- [ ] 공시-뉴스 크로스레퍼런스

### LLM 파이프라인
- [ ] DeepSeek V3 NER (개체명 인식) 연동
- [ ] Claude Sonnet 4 이상 패턴 분석
- [ ] 다중 LLM 앙상블 → 신호 발화
- [ ] 주식셀럽 → 시스템 프롬프트 주입

### 인프라
- [ ] CDN 캐싱 레이어
- [ ] Upstash Redis 연동 (일일 사용자 50명 이상 시)  
  - 현재: 인메모리 Map 폴백 (서버리스에서 초기화됨)  
  - Upstash Free: 256MB, REST API, 10,000 command/일  
  - 설정: Vercel Variables에 `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` 추가
- [ ] OCI Always Free 크롤러 서버
- [ ] CI/CD 자동화

## 가설

> 회사명 변경 + 사업목적 추가 + 소송/경영권 분쟁 + 대주주 변경 →
> 주가 변동성 증가 및 CB/BW 자금조달 패턴 발생
