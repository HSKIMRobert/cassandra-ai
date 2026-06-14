"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get("error") || "");
  const [mode, setMode] = useState<"login" | "signup">("login");

  const supabase = createSupabaseBrowser();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setError("가입 확인 이메일을 발송했습니다. 이메일을 확인해주세요.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Shield className="w-10 h-10 mx-auto text-[var(--accent-glow)]" />
          <h1 className="text-xl font-bold mt-3">CASSANDRA AI</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            DART 공시 × 퀀트 × AI 분석
          </p>
        </div>

        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-4">
          {/* OAuth 버튼 */}
          <div className="space-y-2">
            <button onClick={() => handleOAuth("google")} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google로 계속하기
            </button>

            <button onClick={() => handleOAuth("apple")} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-black text-white text-sm font-medium hover:bg-gray-900 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Apple로 계속하기
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-[10px] text-[var(--text-muted)]">또는</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* 이메일 로그인/회원가입 */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="email@example.com"
                className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)]">비밀번호</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                placeholder="••••••"
                className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm" />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[#ef4444] text-[11px] bg-[#ef4444]/10 rounded p-2">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> :
                mode === "login" ? "로그인" : "회원가입"}
            </button>
          </form>

          <p className="text-center text-[10px] text-[var(--text-muted)]">
            {mode === "login" ? "계정이 없으신가요?" : "이미 계정이 있으신가요?"}{" "}
            <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              className="text-[var(--accent-glow)] hover:underline">
              {mode === "login" ? "회원가입" : "로그인"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent-glow)]" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
