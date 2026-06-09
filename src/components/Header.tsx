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
        <a href="/board" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-[var(--accent-glow)]">CASSANDRA</span>
          <span className="text-xs text-[var(--text-muted)] hidden sm:inline">AI</span>
        </a>
        <nav className="flex items-center gap-2 text-xs">
          <a href="/board" className={`px-3 py-1.5 rounded-lg border transition-colors ${
            pathname === "/board" ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent-glow)]" : "bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)]"
          }`}>
            제보·분석
          </a>
          <a href="/" className={`px-3 py-1.5 rounded-lg border transition-colors ${
            pathname === "/" ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent-glow)]" : "bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)]"
          }`}>
            관계망
          </a>
          <span className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed">
            WIKI <span className="text-[10px]">(작업중)</span>
          </span>
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
