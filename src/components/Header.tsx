"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAuth = useCallback(async () => {
    const supabase = createSupabaseBrowser();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setLoggedIn(!!session);
      if (session?.user?.email) {
        setIsAdmin(ADMIN_EMAILS.includes(session.user.email));
      }
    } catch {
      setLoggedIn(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    window.addEventListener("focus", checkAuth);
    fetch("/api/pageview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: window.location.pathname }) }).catch(() => {});
    return () => window.removeEventListener("focus", checkAuth);
  }, [pathname, checkAuth]);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    setLoggedIn(false);
    setIsAdmin(false);
    router.push("/login");
  };

  const btn = (href: string, label: string) => (
    <a href={href} className={`px-3 py-1.5 rounded-lg border transition-colors text-xs ${
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
          {btn("/dashboard", "코스닥 시그널")}
          <a href="/quant" className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-glow)] hover:bg-[var(--accent)]/20 transition-colors text-xs">
            퀀트 대시보드
          </a>
          <a href="/persona" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors text-xs">
            🎭 페르소나 투자
          </a>
          <a href="/saju" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors text-xs">
            🔮 주식 사주
          </a>
          {btn("/", "관계망 분석")}
          {btn("/board", "제보·분석")}
          {btn("/wiki", "WIKI")}
          {btn("/person-search", "인명검색")}
          {isAdmin && (
            <a href="/admin" className="px-3 py-1.5 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20 transition-colors text-xs">
              ⚙ 관리자
            </a>
          )}
          {loggedIn ? (
            <div className="flex items-center gap-2">
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger-glow)] transition-colors">
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <a href="/expert-apply" className="px-3 py-1.5 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] hover:bg-[#f59e0b]/20 transition-colors text-xs">
                Expert 신청
              </a>
              <a href="/login" className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-glow)] hover:bg-[var(--accent)]/20 transition-colors">
                로그인
              </a>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
