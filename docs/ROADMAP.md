# CASSANDRA AI — 작업 로드맵 & 히스토리

## v1.3.0 (2026-06-14) — 사주 엔진 완성 + 인증 설계

### 사주 엔진 고도화
- [x] 4주(년·월·일·시) 완전 계산
- [x] 십신(10종): 비견·겁재·식신·상관·정재·편재·정관·편관·정인·편인
- [x] 대운(80년): 순행·역행 + 10년 주기 시뮬레이션
- [x] 지장간(12지지): 여기·중기·정기 룩업
- [x] 합충형해: 육합·충·형·파 관계 탐지
- [x] 12운성: 장생·목욕·관대·건록·제왕·쇠·병·사·묘·절·태·양
- [x] 신강/신약: 4주 득세 비율 판단
- [x] 용신·희신·기신: 체질 기반 자동 도출
- [x] 서술형 성격 분석 (장점·단점 + 투자 장단점)
- [x] 연간 총운 (2026 병오년 세운 나래이티브)
- [x] 종합 해설 (만나이·대운 시기·투자 조언)

### 인증 시스템 설계
- [x] Supabase Auth 검토 (Email✅ Google✅ Naver❌ Kakao⚠️)
- [x] 회원 등급 설계 (일반·Expert·관리자 3단계)
- [x] DB 스키마: profiles·referral_codes·expert_applications
- [x] 인증 시나리오 4종 (일반/Expert/추천인/소셜)
- [x] Supabase 마이그레이션 스크립트 (`setup-supabase.sh`)
- [x] SQL 스키마 + RLS 정책 (`supabase-schema.sql`)
- [x] 개발 프로세스: email_confirm:true → SMTP → ON
- [x] 문서: `AUTH_SYSTEM.md`, `SOCIAL_LOGIN.md`

### 문서화
- [x] SAJU_ANALYSIS.md — v1.3.0 엔진 현황 + 개선 우선순위
- [x] 서비스 플로우: 사주·MU-Hynix·레퍼럴 추가
- [x] 소셜 포스팅: NASDAQ 무버 + 사주 출시

---

## v1.1.0 (2026-06-13) — 사주 + 레퍼럴

### 주식 사주 궁합
- [x] 사주 엔진 TypeScript 포팅 (Python vibe-investing → `lib/saju-engine.ts`)
- [x] `/saju` 비로그인 페이지 (60갑자·5운·종목궁합)
- [x] 생년월일·시간 입력 → 일주(일간+일지) + 오늘 일진
- [x] 재물·사업·학업·연애·건강 5운 점수 (0-100)
- [x] 종목명 검색 (티커 + 한글명) + 오행 궁합 분석
- [x] 하루 3회 질문 제한 (localStorage 일자별)
- [x] Redis 캐싱 (동일 생년월일+시간, 24h TTL)
- [x] 브라우저 localStorage 입력값·질문내역 캐싱

### 레퍼럴 시스템
- [x] `?ref=코드` URL 진입 → 추천인 보너스 (+3회, 총 6회)
- [x] Prisma Referral 모델 (refCode, visitorIp, createdAt)
- [x] IP 기준 당일 중복 방지
- [x] `/api/referral`: POST 기록 + GET 통계·순위
- [x] 추천인 코드 (닉네임 기반 자동 생성)
- [x] 초대 메시지 복사 + 후킹 문구
- [x] `npm run saju-stats` CLI 통계

### 기타 개선
- [x] NASDAQ 상승하락 인라인 표시 (클릭 불필요)
- [x] NASDAQ 무버 장기 Redis 캐시 (2회/일 갱신)
- [x] 페이지뷰 KST(UTC+9) 기준 변경

---

## v1.0.0 (2026-06-13) — 퀀트 대시보드 정식 출시

### 퀀트 대시보드
- [x] `/quant` 비로그인 페이지 (ARDS-X · AMQS · ARDS)
- [x] Naver Finance 실시간 NASDAQ 6종목 시그널
- [x] 섹터별 공포·탐욕 지수 (Yahoo Finance × 10 ETF × 5시그널)
- [x] MU(마이크론) → SK하이닉스 예측 (크로스마켓 회귀, 71% 적중)
- [x] 14일 백테스트 리스트 (적중/미적중 + 차이 금액)
- [x] NASDAQ 데일리 상승 Top 10 + 하락 Top 10 + 이유
- [x] NASDAQ 주간 상승 Top 20 + 하락 Top 10 (Jun 8-13)
- [x] TypeScript 퀀트 포팅 (`lib/quant-calc.ts`, `lib/sector-fear-greed.ts`, `lib/mu-hynix-predict.ts`)
- [x] Redis 10분 캐시 + 새로고침 강제 갱신
- [x] 백테스트 방법론 (`docs/QUANT_BACKTEST.md`)
- [x] 차트 툴팁 가시성 개선 (어두운 배경)
- [x] MuHynixPrediction DB 모델 + GitHub JSON 저장
- [x] 퀀트 원본 보기 팝업 (ARDS-X, AMQS, ARDS, MU-Hynix)

### 보안 강화
- [x] 페이지뷰 Redis 캐시 + Prisma(Neon DB) 영구 저장
- [x] Path Traversal 취약점 패치 (person-search 2건)
- [x] 전체 코드 XSS/SQL Injection 감사 통과
- [x] API 키·비밀번호 gitignored 검증 완료

### 문서화
- [x] README v2 — 스크린샷 3장 + 소셜 포스팅
- [x] SERVICE_FLOW — 퀀트 + 페이지뷰 플로우
- [x] SOCIAL_POSTS.md — LinkedIn·Facebook·X 포스트
- [x] ROADMAP 히스토리 정리

---

## v0.7.0 (2026-06-11) — 관계망 + 인물 검색

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
- [x] Upstash Redis 연동 (검색·그래프·챗봇)

---

## 진행 중

### 인증 마이그레이션
- [ ] Supabase 실제 연동 (Google OAuth)
- [ ] SMTP 연결 (Resend)
- [ ] Expert 승인 관리자 대시보드
- [ ] 기존 Neon → Supabase 사용자 마이그레이션

### 데이터 확장
- [ ] 전체 코스닥 상시 공시 캐싱
- [ ] 공시-뉴스 크로스레퍼런스

### LLM 파이프라인
- [ ] DeepSeek V3 NER (개체명 인식) 연동
- [ ] Claude Fable 5 이상 패턴 분석

### 퀀트 고도화
- [ ] Toss Securities API 연동
- [ ] ARDS 자동 리밸런싱 GitHub Actions

### 사주 엔진 고도화
- [ ] 음력 변환 지원
- [ ] 종목 오행 LLM 자동 분류 (20→200+)

## 가설

> 회사명 변경 + 사업목적 추가 + 소송/경영권 분쟁 + 대주주 변경 →
> 주가 변동성 증가 및 CB/BW 자금조달 패턴 발생
