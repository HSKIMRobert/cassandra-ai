# Expert 인증 시스템 — 사용자 & 관리자 매뉴얼

> **v1.4.0** | Supabase Auth + 언론·공공기관 전용 인증

---

## 1. 개요

Expert 회원은 **언론사·공공기관(경찰·검찰 등)** 관계자에게만 부여되는 권한입니다.  
Google 로그인 후 기관 이메일을 인증하면 관계망 분석, 제보·분석, WIKI, 인명검색 등 **딥서치 기능**을 이용할 수 있습니다.

---

## 2. Expert 신청 방법 (사용자)

### Step 1: Google 로그인
```
https://dart-monitor-pi.vercel.app/login
→ Google로 계속하기 클릭
```

### Step 2: Expert 신청 페이지 이동
```
https://dart-monitor-pi.vercel.app/expert-apply
(또는 상단 메뉴 → Expert 신청)
```

### Step 3: 이메일 도메인 검증
- 로그인한 Google 이메일이 자동 입력됨
- "이메일 도메인 검증" 버튼 클릭
- **허용 도메인**이면 ✅ 표시

### Step 4: Expert 신청
- "Expert 신청" 버튼 클릭
- **관리자 승인 대기** 상태로 전환

### Step 5: 관리자 승인 대기
- 관리자가 검토 후 승인 (1-2일 소요)
- 승인 시 인증 이메일(OTP) 발송

### Step 6: 이메일 인증 완료
- 발송된 OTP 확인 (Supabase Magic Link)
- "이메일 인증 완료" 버튼 클릭
- **Expert 활성화** → 모든 딥서치 기능 사용 가능

### 재인증 (6개월 주기)
- Expert 인증 후 6개월마다 자동 재인증 필요
- 로그인 시 OTP 이메일 발송 → 인증 완료

---

## 3. 관리자 승인 방법

### 접근
```
https://dart-monitor-pi.vercel.app/admin
(gameworker@gmail.com 로그인 필요)
```

### Expert 승인 대기 목록 확인
- 하단 "Expert 승인 대기" 패널에서 신청 목록 확인
- **승인**: OTP 발송 + Expert 등급 부여
- **거절**: 신청 취소

### Expert 등급 관리
관리자 페이지에서 현재 Expert 회원의 인증 상태 확인 가능:
- **인증완료**: 정상 사용 중
- **승인됨**: OTP 인증 대기 중
- **대기**: 관리자 승인 대기 중

---

## 4. 권한 체계

| 등급 | 경제지표 | 퀀트 | 사주 | 관계망 | 제보 | WIKI | 인명검색 | 관리자 |
|------|---------|------|------|--------|------|------|---------|--------|
| 비로그인 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 일반회원 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Expert | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 관리자 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. 허용 이메일 도메인

### 언론사 (24개)
```
jtbc.co.kr, sbs.co.kr, mbc.co.kr, kbs.co.kr,
chosun.com, joongang.co.kr, donga.com, hani.co.kr,
kmib.co.kr, segye.com, yna.co.kr, newsis.com,
news1.kr, newspim.com, dt.co.kr, etnews.com,
hankyung.com, mk.co.kr, sedaily.com, edaily.co.kr,
fnnews.com, mt.co.kr, bizwatch.co.kr, bloter.net
```

### 공공기관 (16개)
```
police.go.kr, spo.go.kr, korea.kr, moj.go.kr,
mosf.go.kr, assembly.go.kr, court.go.kr, nps.or.kr,
fss.or.kr, kofia.or.kr, krx.co.kr, fsi.or.kr,
bok.or.kr, kdi.re.kr, nars.go.kr, ftc.go.kr
```

> 하위 도메인도 허용 (예: press.kbs.co.kr → kbs.co.kr 매칭)

---

## 6. 기술 스펙

| 항목 | 내용 |
|------|------|
| 인증 방식 | Supabase Auth (Google OAuth + Email OTP) |
| 도메인 검증 | `lib/expert.ts` — 40+ 기관 화이트리스트 |
| 재인증 주기 | 180일 (6개월) |
| DB 저장 | Neon DB `AppUser.tier` + `expertVerifiedAt` |
| API | `/api/auth/expert` (apply·approve·reject·verify-otp·status·list) |

---

## 7. 트러블슈팅

| 문제 | 해결 |
|------|------|
| "허용된 기관 이메일이 아닙니다" | 사용 중인 이메일 도메인이 화이트리스트에 없음. 관리자에게 도메인 추가 요청 |
| "관리자 승인 대기 중" | 정상 상태. 1-2일 내 승인 처리됨 |
| "이메일 인증이 필요합니다" | 수신함에서 Supabase OTP 메일 확인 후 링크 클릭 |
| Google 로그인 안 됨 | Google Cloud Console 리디렉션 URI 확인 |
