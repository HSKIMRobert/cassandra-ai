import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CASSANDRA AI — LLM-Powered Distressed Company Disclosure Intelligence",
  description: "DART 공시 기반 한계기업 관계망 추적 및 이상 탐지 시스템",
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
            </a>
            <nav className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
              <a href="/" className="px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--text)] transition-colors">
                관계망 분석
              </a>
              <a href="/board" className="px-3 py-1.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent-glow)] hover:bg-[var(--accent)]/20 transition-colors">
                제보·분석요청
              </a>
              <span className="text-[var(--border)]">|</span>
              <span className="text-xs">v0.1.0-beta</span>
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
