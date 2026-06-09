"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        if (data.duplicateLogin) setDuplicate(true);
        router.push("/board");
        router.refresh();
      }
    } catch {
      setError("서버 오류가 발생했습니다");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        {/* 로고 */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="w-8 h-8 text-[var(--accent-glow)]" />
            <span className="text-2xl font-bold text-[var(--accent-glow)]">CASSANDRA AI</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Toss × DART × LLM 리스크 모니터링
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4 p-6 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <h2 className="text-sm font-semibold text-center">로그인</h2>

          {duplicate && (
            <div className="p-2 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)] text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              이미 로그인된 세션이 있습니다
            </div>
          )}

          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@domain.com"
              required
              className="w-full mt-1 px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[var(--text-muted)] uppercase">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full mt-1 px-3 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger-glow)] text-xs flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            로그인
          </button>

          <p className="text-center text-[10px] text-[var(--text-muted)]">
            가입 문의:{" "}
            <a href="mailto:gameworker@gmail.com" className="text-[var(--accent-glow)] hover:underline">
              gameworker@gmail.com
            </a>
          </p>
        </form>

        {/* 하단 정보 */}
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2 text-[10px] text-[var(--text-muted)]">
          <p>
            <strong className="text-[var(--warning)]">CASSANDRA AI</strong> — 
            Toss Securities API × DART OpenAPI × LLM 기반 투자 리스크 모니터링 툴입니다.
            코스닥 시장의 소음 속에서 이상 징후 신호를 찾아내고, LLM이 관계망을 분석하여
            하나의 흐름으로 재구성하는 공익 목적의 분석 시스템입니다.
          </p>
          <div className="flex items-center gap-2 pt-1 border-t border-[var(--border)]">
            <a href="https://github.com/gameworkerkim/vibe-investing" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-glow)] hover:underline">
              github.com/gameworkerkim/vibe-investing
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
