# CASSANDRA AI — 작업 로드맵

## 완료 (v0.4.0)

- [x] 관계망 그래프 (Cytoscape.js) + 통합 검색
- [x] 실시간 검색어 순위 (24시간 기준)
- [x] 핀보드 — 인물·법인·회사 핀 고정
- [x] 이상 징후 분석 리포트 생성 (MD 다운로드)
- [x] 동명이인 생년월일 구분 (SameNameGroup)
- [x] 집단 평가 투표 (BAD ASS / Good) + 댓글
- [x] 제보·분석요청 게시판
- [x] CB 신호 6종 자동 탐지
- [x] 법인명 변경 추적 (CorpEvent + NAME_CHANGE_PIVOT 신호)
- [x] 경제 지표 대시보드 (Naver 모바일 API → 시총/거래량/등락률)
- [x] 코스닥 100종목 추출 + JSON 데이터 (SPAC·시총1000억 제외 필터)
- [x] 샘플 백테스팅 데이터 (5개 사례, 18개 회사, 60+ 공시)

## 진행 중

### Phase 1 — DART 실공시 연동
- [ ] DART corp_code 룩업 테이블 구축 (ZIP 파싱)
- [ ] Naver 종목코드 → DART corp_code 매핑
- [ ] 12개월 내 사명변경·대주주변경·사업목적추가·소송/분쟁 자동 검출
- [ ] DART OpenAPI 실시간 폴링 (당일 공시 자동 수집)
- [ ] 100종목 유니버스 풀 자동 갱신

### Phase 2 — LLM 파이프라인
- [ ] DeepSeek V3 NER (개체명 인식) 연동
- [ ] Claude Sonnet 4 이상 패턴 분석
- [ ] 다중 LLM 앙상블 → 신호 발화
- [ ] 작전세력 블랙리스트 → 시스템 프롬프트 주입

### Phase 3 — 뉴스·외부 데이터
- [ ] NAVER 뉴스 검색 API 연동
- [ ] 공시-뉴스 크로스레퍼런스
- [ ] KIND 상장폐지·관리종목 데이터 연동
- [ ] Toss Securities Open API 연동 (실시간 주가·거래량)

### Phase 4 — 회원·인증
- [ ] Google / Naver 이메일 인증
- [ ] 기자·검사·경찰 역할 기반 접근 제어
- [ ] 수사기관 무제한 API 이용
- [ ] 기자 → 작전세력 정보 입력 → LLM 추가 학습

### Phase 5 — 챗봇 분석
- [ ] LLM 기반 챗봇 인터페이스 (자연어 질의)
- [ ] "A기업과 B인물의 관계 분석해줘" → 연관도 + 이벤트 타임라인 응답
- [ ] 특정 기업·인물·법인·조합의 과거 코스닥 상장사 이벤트 연관도 분석
- [ ] 뉴스 크로스레퍼런스 + 공시 패턴 기반 리스크 평가
- [ ] "현재 공시 패턴의 위험도를 평가해줘" → 신호 점수 + 근거 요약
- [ ] 스트리밍 응답 (DeepSeek/Claude)

### Phase 6 — 고도화
- [ ] 검증 사용자(기자·검사·경찰) 평가 시스템 + 평판 추적
- [ ] 위키 형태 정보 축적 (엔티티별 공시·사건·뉴스)
- [ ] 바지(명의자) - 주세력 관계망 시각화
- [ ] TimescaleDB 시계열 군집 분석 (이상치 탐지)

### Phase 7 — 배포
- [ ] CI/CD 파이프라인 (GitHub Actions)
- [ ] Vercel / OCI 프로덕션 배포
- [ ] 모니터링 (Uptime Kuma)
- [ ] 일일 리포트 자동 발송

## 가설

> 회사명 변경 + 사업목적 추가 + 소송/경영권 분쟁 + 대주주 변경 →
> 주가 변동성 증가 및 CB/BW 자금조달 패턴 발생

## 기술 스택

| 계층 | 현재 | 계획 |
|---|---|---|
| 백엔드 | Next.js 15 + TypeScript + Express | |
| DB | PostgreSQL 16 | + TimescaleDB |
| ORM | Prisma 6 | |
| 프론트엔드 | React 19 + Tailwind CSS 4 + Cytoscape.js | |
| 외부 API | Naver Finance (모바일) | + OpenDART, Toss Securities, NAVER News |
| LLM | — | DeepSeek V3 + Claude Sonnet 4 |
| 데이터 | 100종목 JSON | + DART 실시간 공시 매칭 |
