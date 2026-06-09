import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "CASSANDRA AI — Toss × DART × LLM 투자 리스크 모니터링",
  description: "코스닥 시장 공시·거래 데이터 분석, 이상 징후 탐지, 관계망 분석 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
