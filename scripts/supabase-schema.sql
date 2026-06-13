-- CASSANDRA AI — Supabase DB 스키마
-- 실행: Supabase 대시보드 → SQL Editor → 복사/붙여넣기 → Run

-- 1. 프로필 테이블
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  tier TEXT DEFAULT 'normal' CHECK (tier IN ('normal','expert','admin')),
  nickname TEXT,
  company_email TEXT,
  company_email_verified BOOLEAN DEFAULT FALSE,
  company_name TEXT,
  referrer_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Expert 승인 신청
CREATE TABLE IF NOT EXISTS public.expert_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_email TEXT NOT NULL,
  company_name TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 3. 추천인 코드
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  used_count INT DEFAULT 0,
  max_per_week INT DEFAULT 5,
  week_start DATE DEFAULT (CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 자동 프로필 생성 (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'tier', 'normal'),
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. RLS 정책 (Row Level Security)

-- profiles: 자신의 프로필만 읽기/수정
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Admin can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tier = 'admin'
  ));

-- expert_applications: 자신의 신청만 조회
ALTER TABLE public.expert_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications"
  ON public.expert_applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create applications"
  ON public.expert_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage applications"
  ON public.expert_applications FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tier = 'admin'
  ));

-- referral_codes: Expert만 조회/생성
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expert can view own codes"
  ON public.referral_codes FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Expert can create codes"
  ON public.referral_codes FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND tier = 'expert')
  );

-- 6. 관리자 계정 등록 (최초 1회 실행)
-- 아래 이메일을 실제 관리자 이메일로 변경 후 실행
-- INSERT INTO public.profiles (id, email, tier, nickname)
-- SELECT id, email, 'admin', '관리자'
-- FROM auth.users WHERE email = 'admin@example.com';

-- 7. 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON public.profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_referrer ON public.profiles(referrer_code);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.expert_applications(status);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
