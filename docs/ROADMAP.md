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

## 완료 (v0.6.0) — 분석 파이프라인 + 접근 제어

- [x] **게시판/보고서 탭 전환** — 상단 pill 버튼, 보고서 탭에서 검색·확장·복사
- [x] **✓ 분석완료 뱃지** — RESOLVED 게시물에 초록 테두리 + 뱃지
- [x] **배치 분석 파이프라인** (`scripts/process-batch.ts`)
  - DeepSeek v3(`deepseek-chat`)로 AI 분석
  - DART API 최신 공시 URL 포함 → 근거 출처 제공
  - 동일 날짜 중복 분석 방지 (`findTodayDoneJob`)
  - 분석 완료 후 관련 BoardPost 자동 RESOLVED 처리
- [x] **배치 조정 API** (`/api/batch-reconcile`) — 기존 PENDING 게시물 일괄 상태 업데이트
- [x] **관리자 초대 시스템**
  - 어드민 대시보드에서 이메일 입력 → 7일 만료 초대 링크 생성
  - 초대 이력 테이블 (이메일, 만료일, 상태: 대기/만료/가입완료, 링크 복사)
  - `ExpertInvite` Prisma 모델 + `/api/admin/invite` (POST/GET/PATCH)
- [x] **초대 가입 페이지** (`/invite?email=xxx`)
  - 초대 상태 검증 (not_invited / expired / already_used / ok)
  - 이름 + 비밀번호 + 비밀번호 확인 → 가입하기
  - 가입 후 즉시 `signInWithPassword` 시도 → 성공 시 `/dashboard` 리다이렉트
  - Supabase 이메일 인증 설정 켜져 있는 경우 인증 메일 안내 화면으로 폴백
- [x] **미들웨어 Expert 접근 제어**
  - `EXPERT_EMAILS` 하드코딩 외에 `user_metadata.role === "expert"` 도 허용
  - Google OAuth 사용자(admin) + 초대 가입 사용자(expert) 모두 통과

## 진행 중

### 데이터 확장
- [ ] 전체 코스닥 상시 공시 캐싱
- [ ] DART dsab007 인물명 검색 파이프라인
- [ ] 공시-뉴스 크로스레퍼런스

### LLM 파이프라인
- [ ] DeepSeek V3 NER (개체명 인식) 연동
- [ ] Claude Sonnet 4 이상 패턴 분석
- [ ] 다중 LLM 앙상블 → 신호 발화

### 인프라
- [ ] Supabase Dashboard에서 "Confirm email" 비활성화 → 초대 가입 이메일 인증 완전 제거
- [ ] CDN 캐싱 레이어
- [ ] OCI Always Free 크롤러 서버

## 시스템 아키텍처 요약

| 레이어 | 기술 |
|--------|------|
| 프론트 | Next.js 15.5 App Router + Tailwind |
| 인증 | Supabase SSR Auth (Google OAuth + 이메일/비밀번호) |
| DB | Neon PostgreSQL + Prisma 6 |
| 캐시 | Upstash Redis |
| 배포 | Vercel (GitHub Actions → 자동 배포) |
| AI | DeepSeek v3 (`deepseek-chat`) |
| 공시 | DART Open API (`opendart.fss.or.kr`) |

## 접근 권한 구조

```
관리자(Admin)    → EXPERT_EMAILS 목록에 포함된 Google 로그인 계정
Expert 회원      → 관리자 초대 링크로 가입, user_metadata.role = "expert"
일반 방문자      → /access-denied 리다이렉트
```

## 가설

> 회사명 변경 + 사업목적 추가 + 소송/경영권 분쟁 + 대주주 변경 →
> 주가 변동성 증가 및 CB/BW 자금조달 패턴 발생
