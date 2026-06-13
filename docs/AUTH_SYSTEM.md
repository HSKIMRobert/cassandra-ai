# 회원 인증 시스템 설계 — Supabase 기반

> **상태**: 설계 검토 단계
> **현재 인증**: JWT + bcryptjs (Neon DB 자체 구현)
> **목표**: Supabase Auth로 마이그레이션 + 회원 등급제 도입

---

## 1. Supabase 인증 기능 검토

### 1.1 지원 인증 방식

| 방식 | 지원 여부 | 비고 |
|------|----------|------|
| 이메일/비밀번호 | ✅ | Magic Link 포함 |
| 이메일 인증 (OTP) | ✅ | 가입 후 이메일 인증 필수 설정 가능 |
| Google OAuth | ✅ | 기본 지원 |
| Apple OAuth | ✅ | 기본 지원 |
| Naver OAuth | ❌ | OIDC 커스텀 연동 필요, 복잡 |
| Kakao OAuth | ⚠️ 부분 | OIDC 연동 가능하나 불안정 |
| SMS 인증 | ✅ | Twilio 연동 필요 |
| 회사 이메일 도메인 제한 | ✅ | RLS + Trigger로 구현 가능 |

### 1.2 결론

- **이메일/비밀번호 + 이메일 인증** → ✅ 사용
- **Google/Apple 소셜 로그인** → ✅ 사용
- **Naver/Kakao** → ❌ 포기 (기본 미지원, OIDC 연동 복잡)

---

## 2. 회원 등급 설계

### 2.1 등급별 권한

| 등급 | 접근 가능 페이지 | 가입 방식 |
|------|-----------------|----------|
| **일반회원** | 경제지표·퀀트·사주 | 이메일 가입 + 이메일 인증 |
| **Expert** | 전체 기능 (관계망·제보·WIKI·인명검색) | 회사 메일 인증 + 관리자 승인 + 추천인 코드 |
| **관리자** | 전체 기능 + 관리자 패널 | 지정 이메일 계정 (수동 등록) |

### 2.2 DB 스키마 확장

```sql
-- Supabase auth.users에 메타데이터 추가
-- user_metadata: { tier: 'normal' | 'expert' | 'admin', referrer: 'REFCODE' }

-- 프로필 테이블
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'normal' CHECK (tier IN ('normal','expert','admin')),
  nickname TEXT,
  company_email TEXT,          -- Expert 전용: 회사 이메일
  company_email_verified BOOLEAN DEFAULT FALSE,
  referrer_code TEXT,          -- 본인의 추천인 코드
  referred_by TEXT,            -- 가입 시 사용한 추천인 코드
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expert 추천인 코드 관리
CREATE TABLE public.referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  code TEXT UNIQUE NOT NULL,
  used_count INT DEFAULT 0,   -- 이번 주 사용 횟수
  max_per_week INT DEFAULT 5,
  week_start DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expert 승인 대기
CREATE TABLE public.expert_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  company_email TEXT NOT NULL,
  company_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);
```

---

## 3. 인증 시나리오

### 3.1 일반 회원 가입

```
1. 사용자 → /login 페이지 → "회원가입" 클릭
2. 이메일 + 비밀번호 입력 → Supabase signUp()
3. Supabase → 가입 확인 이메일 발송 (Magic Link 또는 OTP)
4. 사용자 → 이메일 링크 클릭 → 인증 완료
5. 리다이렉트 → /dashboard (일반 회원 대시보드)
6. 접근 가능: 경제지표, 퀀트, 사주
```

### 3.2 Expert 회원 가입

```
1. 일반 회원 가입 완료 (선행 조건)
2. /expert-apply 페이지 → 회사 이메일 입력
3. company_email 검증:
   - @gmail.com, @naver.com 등 무료 도메인 → 거부
   - @회사명.com → 허용
4. Supabase Trigger → company_email_verified = FALSE, status = 'pending'
5. 관리자 → 대시보드에서 승인 검토
   - 회사 이메일 도메인 확인
   - 회사명 + 소속 확인
6. 승인 완료 → tier = 'expert', 추천인 코드 5개 발급
7. 모든 기능 사용 가능
```

### 3.3 추천인 가입

```
1. Expert 회원 → "친구 초대" → 추천인 링크 생성
   https://dart-monitor-pi.vercel.app/login?ref=EXPERT_CODE
2. 신규 사용자 → 링크 클릭 → 일반 회원 가입 진행
3. 가입 시 referred_by = EXPERT_CODE 저장
4. 가입 완료 → 일반 회원으로 시작
5. Expert 신청 시 → referred_by 확인 → 승인 우대 (패스트트랙)
6. 추천인 코드 사용 횟수 +1 (주간 5회 제한 체크)
```

### 3.4 소셜 로그인 (Google)

```
1. 사용자 → "Google로 로그인" 클릭
2. Supabase → Google OAuth 리다이렉트
3. Google 인증 완료 → Supabase callback
4. 최초 로그인 → profiles 테이블에 사용자 생성 (tier='normal')
5. 리다이렉트 → /dashboard
```

---

## 4. Supabase 마이그레이션 계획

### 4.1 현재 → Supabase 이전 항목

| 현재 (Neon + 자체 Auth) | Supabase 대체 |
|-------------------------|--------------|
| `prisma User` 테이블 | `auth.users` + `public.profiles` |
| JWT 발급 (bcryptjs) | Supabase JWT (GoTrue) |
| 로그인 API | Supabase `signInWithPassword()` |
| 세션 관리 (쿠키) | Supabase 세션 (자동 갱신) |
| 미들웨어 인증 검사 | Supabase SSR 미들웨어 |
| LoginHistory 추적 | Supabase Audit Logs (Pro) 또는 커스텀 |

### 4.2 유지할 것

| 항목 | 이유 |
|------|------|
| Prisma + Neon DB | 기존 데이터 유지 (공시·인물·관계망) |
| Redis 캐시 | Upstash 계속 사용 |
| 사주 엔진 | 자체 로직 |
| 페이지뷰·레퍼럴 | 기존 DB 테이블 유지 |

### 4.3 환경 변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # 서버 전용, 노출 금지

# 기존 유지
DATABASE_URL=postgresql://...       # Neon DB (데이터용)
UPSTASH_REDIS_REST_URL=https://...
DART_API_KEY=...
```

---

## 5. 구현 우선순위

| 순위 | 작업 | 예상 소요 | 의존성 |
|------|------|----------|--------|
| P0 | Supabase 프로젝트 생성 + SDK 설치 | 1시간 | 없음 |
| P0 | 이메일 가입 + 로그인 (Supabase Auth) | 3시간 | SDK |
| P0 | 회원 등급 DB 스키마 (profiles) | 1시간 | DB |
| P0 | 미들웨어 → Supabase SSR 전환 | 2시간 | Auth |
| P1 | Expert 신청 + 관리자 승인 플로우 | 4시간 | profiles |
| P1 | 추천인 코드 시스템 | 3시간 | Expert |
| P1 | Google 소셜 로그인 | 2시간 | Supabase |
| P2 | Apple 소셜 로그인 | 3시간 | Apple Developer |
| P2 | 페이지별 접근 제어 (tier 기반) | 2시간 | 미들웨어 |
| P2 | 기존 사용자 마이그레이션 | 3시간 | 이전 데이터 |
| P3 | 관리자 대시보드 | 4시간 | 모든 기능 |

---

## 6. 위험 요소

| 위험 | 영향 | 대응 |
|------|------|------|
| Supabase 무료 MAU 50,000 초과 | 서비스 중단 | Pro 플랜($25/월) 전환 |
| 네이버 로그인 불가 | 한국 사용자 불편 | Google 로그인으로 대체 |
| 기존 Neon DB와 Supabase DB 분리 | 쿼리 복잡도 증가 | Prisma 다중 DB 설정 |
| Expert 승인 지연 | 사용자 이탈 | 자동 도메인 검증 로직 추가 |
| 추천인 코드 남용 | 품질 저하 | 주간 5회 제한 + CAPTCHA |

## 8. 개발 단계별 계획

### 개발 중 (현재)
- `email_confirm: true`로 관리자 API(`auth.admin.createUser`) 사용
- 인증 메일 발송 없이 즉시 로그인 가능
- 빠른 기능 개발 및 테스트

```typescript
// 개발 중: Service Role Key로 이메일 인증 스킵
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
await supabase.auth.admin.createUser({
  email: "test@example.com",
  password: "password123",
  email_confirm: true,  // 인증 메일 안 보냄, 바로 로그인 가능
});
```

### 개발 완료 후
1. SMTP 서비스 연결 (Resend 추천 — 월 3,000건 무료)
2. Supabase → Authentication → Email Templates 커스터마이징
3. `email_confirm: false`로 전환 (실제 이메일 인증 활성화)
4. Confirm email: ON

### SMTP 연결 (Resend 예시)
```bash
# Supabase 대시보드 → Authentication → Settings → SMTP
Host: smtp.resend.com
Port: 465
User: resend
Password: re_xxxxx (Resend API Key)
Sender: CASSANDRA AI <noreply@dart-monitor.xyz>
```

---

## 9. 오늘 작업 요약 (2026-06-14)

1. **회사 이메일 인증**: Supabase 자체 기능만으로 회사 도메인 검증이 되는지 확인 필요
   - 대안: 수동 승인 + SMTP 설정으로 커스텀 이메일 발송
   
2. **RLS와 기존 Prisma**: Supabase RLS를 사용하면 Prisma에서 직접 접근 불가
   - 대안: `service_role` 키로 Prisma 연결 유지, RLS는 Supabase SDK 전용
   
3. **무료 티어 한도**: MAU 50,000 + DB 500MB → 현재 2,740 레코드로 충분

---

## 9. 오늘 작업 요약 (2026-06-14)

### 완료
- [x] Supabase Auth 기능 검토 (Email✅ Google✅ Naver❌ Kakao⚠️)
- [x] 회원 등급 설계 (일반·Expert·관리자)
- [x] DB 스키마 설계 (profiles, referral_codes, expert_applications)
- [x] 4종 인증 시나리오 문서화
- [x] Supabase 마이그레이션 스크립트 (setup-supabase.sh)
- [x] SQL 스키마 + RLS 정책 (supabase-schema.sql)
- [x] Supabase 클라이언트 (server/client)
- [x] Auth API route (signup·expert-apply)
- [x] 미들웨어 (JWT + Supabase 병행)
- [x] 소셜 로그인 설계 문서 (SOCIAL_LOGIN.md)
- [x] 이메일 인증 개발 프로세스 정립 (email_confirm:true → SMTP → ON)

### 사주 엔진
- [x] 4주(년월일시) + 십신·대운·지장간·합충·12운성·용신
- [x] 주간·월간·연간 운세 + 종합 해설

### 진행 대기
- [ ] SMTP 서비스 결정 (Resend 추천)
- [ ] Supabase 실제 연동 (Google OAuth 우선)
- [ ] Expert 승인 관리자 대시보드
- [ ] 기존 사용자 마이그레이션
