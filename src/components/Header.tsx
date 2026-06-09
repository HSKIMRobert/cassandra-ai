"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);

  const checkAuth = useCallback(() => {
    setLoggedIn(document.cookie.includes("session="));
  }, []);

  useEffect(() => {
    checkAuth();
    // 포커스 복귀 시에도 체크
    window.addEventListener("focus", checkAuth);
    return () => window.removeEventListener("focus", checkAuth);
  }, [pathname, checkAuth]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setLoggedIn(false);
    document.cookie = "session=; max-age=0; path=/";
    router.push("/login");
  };

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-[var(--accent-glow)]">CASSANDRA</span>
          <span className="text-xs text-[var(--text-muted)] hidden sm:inline">AI</span>
          <span className="hidden lg:inline text-[10px] text-[var(--text-muted)] ml-2 pl-2 border-l border-[var(--border)]">
            Toss × DART × LLM 리스크 모니터링
          </span>
        </a>
        <nav className="flex items-center gap-2 text-xs">
          <a href="/" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors">
            관계망 분석
          </a>
          <a href="/dashboard" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors">
            경제 지표
          </a>
          <a href="/board" className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-glow)] hover:bg-[var(--accent)]/20 transition-colors">
            제보·분석
          </a>
          {loggedIn ? (
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger-glow)] transition-colors">
              로그아웃
            </button>
          ) : (
            <a href="/login" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors">
              로그인
            </a>
          )}
          <span className="text-xs text-[var(--text-muted)]">v0.3.0</span>
        </nav>
      </div>
    </header>
  );
}
