"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [usageWarning, setUsageWarning] = useState(false);

  const checkAuth = useCallback(() => {
    setLoggedIn(document.cookie.includes("session="));
  }, []);

  useEffect(() => {
    checkAuth();
    window.addEventListener("focus", checkAuth);
    // 페이지뷰 기록
    fetch("/api/pageview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: window.location.pathname }) }).catch(() => {});
    return () => window.removeEventListener("focus", checkAuth);
  }, [pathname, checkAuth]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setLoggedIn(false);
    document.cookie = "session=; max-age=0; path=/";
    router.push("/login");
  };

  const btn = (href: string, label: string) => (
    <a href={href} className={`px-3 py-1.5 rounded-lg border transition-colors ${
      pathname === href ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent-glow)]" : "bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)]"
    }`}>{label}</a>
  );

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <a href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-[var(--accent-glow)]">CASSANDRA</span>
          <span className="text-xs text-[var(--text-muted)] hidden sm:inline">AI</span>
        </a>
        <nav className="flex items-center gap-2 text-xs">
          {btn("/dashboard", "경제 지표")}
          {btn("/", "관계망 분석")}
          {btn("/board", "제보·분석")}
          {btn("/wiki", "WIKI")}
          {btn("/person-search", "인명검색")}
          <a href="/dashboard" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors">
            이 서비스에 대해
          </a>
          {loggedIn ? (
            <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger-glow)] transition-colors">
              로그아웃
            </button>
          ) : (
            <a href="/login" className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-glow)] hover:bg-[var(--accent)]/20 transition-colors">
              로그인
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
