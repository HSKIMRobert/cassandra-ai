import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CASSANDRA AI — Toss × DART × LLM 투자 리스크 모니터링",
  description: "코스닥 시장 공시·거래 데이터 분석, 이상 징후 탐지, 관계망 분석 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-[var(--accent-glow)]">
                CASSANDRA
              </span>
              <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                AI
              </span>
              <span className="hidden lg:inline text-[10px] text-[var(--text-muted)] ml-2 pl-2 border-l border-[var(--border)]">
                Toss × DART × LLM 리스크 모니터링
              </span>
            </a>
            <nav className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <a href="/" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors">
                관계망 분석
              </a>
              <a href="/dashboard" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors">
                경제 지표
              </a>
              <a href="/board" className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-glow)] hover:bg-[var(--accent)]/20 transition-colors">
                제보·분석요청
              </a>
              <span className="text-[var(--border)]">|</span>
              <span className="text-xs">v0.3.0-beta</span>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
