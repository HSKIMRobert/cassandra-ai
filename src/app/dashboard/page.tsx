"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import {
  TrendingUp, BarChart3, Search, Loader2, ArrowUp, ArrowDown, Minus, Activity,
} from "lucide-react";

interface StockItem {
  rank: number;
  name: string;
  code?: string;
  price: string;
  change: string;
  volume?: string;
}

interface Snapshot {
  id: string;
  category: string;
  data: StockItem[] | string;
  stats: any;
  createdAt: string;
}

const CATEGORY_LABEL: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  TOP_VOLUME: { label: "거래량 상위", icon: <BarChart3 className="w-3.5 h-3.5" />, color: "text-[var(--accent-glow)]" },
  TOP_TURNOVER: { label: "거래대금 상위", icon: <Activity className="w-3.5 h-3.5" />, color: "text-[var(--warning)]" },
  TOP_GAINERS: { label: "급등 상위", icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-[#ff4444]" },
  TOP_SEARCH: { label: "검색 상위", icon: <Search className="w-3.5 h-3.5" />, color: "text-[var(--person-color)]" },
  VOLUME_PLUNGE: { label: "거래량 급감", icon: <ArrowDown className="w-3.5 h-3.5" />, color: "text-[var(--accent-glow)]" },
};

export default function DashboardPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setSnapshots(d.snapshots || []);
        setLoading(false);
      })
      .catch(() => {
        setError("데이터를 불러올 수 없습니다");
        setLoading(false);
      });
  }, []);

  const parseStocks = (data: any): StockItem[] => {
    if (Array.isArray(data)) return data;
    if (typeof data === "string") {
      try { return JSON.parse(data); } catch {}
    }
    return [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-glow)]" />
        <span className="ml-3 text-[var(--text-muted)]">경제 지표 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5" /> 경제 지표 대시보드
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Naver Finance · 코스닥 거래량/급등/검색 상위
            {snapshots.length > 0 && ` · ${format(new Date(snapshots[0].createdAt), "MM/dd HH:mm", { locale: ko })} 기준`}
          </p>
        </div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 관계망 분석</a>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)] text-sm">
          {error}
        </div>
      )}

      {snapshots.length === 0 && !error && (
        <div className="p-4 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-[var(--warning)] text-sm">
          Naver Finance 크롤링에 실패했습니다. stock.naver.com은 동적 렌더링 + 안티봇으로 인해
          Puppeteer로도 완전한 데이터 수집이 어렵습니다. 추후 KRX Open API 또는
          대체 데이터 소스로 연동할 예정입니다.
        </div>
      )}

      {snapshots.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          실시간 데이터 수집 준비 중...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {snapshots.map((snap) => {
            const stocks = parseStocks(snap.data);
            const cat = CATEGORY_LABEL[snap.category] || CATEGORY_LABEL.TOP_VOLUME;
            const stats = typeof snap.stats === "string" ? JSON.parse(snap.stats) : snap.stats;

            return (
              <div key={snap.id} className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cat.color}>{cat.icon}</span>
                    <span className="text-sm font-semibold">{cat.label}</span>
                  </div>
                  {stats && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-[#ff4444] flex items-center gap-0.5"><ArrowUp className="w-3 h-3" />{stats.gainerCount}</span>
                      <span className="text-[var(--text-muted)] flex items-center gap-0.5"><Minus className="w-3 h-3" />{stats.neutralCount}</span>
                      <span className="text-[#44dd44] flex items-center gap-0.5"><ArrowDown className="w-3 h-3" />{stats.loserCount}</span>
                      <span className="text-[var(--text-muted)] ml-1">평균 {stats.avgChangePercent > 0 ? "+" : ""}{stats.avgChangePercent}%</span>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {stocks.slice(0, 10).map((s, i) => (
                    <a
                      key={i}
                      href={`/?q=${encodeURIComponent(s.name)}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--border)]/20 transition-colors"
                    >
                      <span className={`w-5 text-center text-[10px] font-bold shrink-0 ${
                        i < 3 ? "text-[var(--accent-glow)]" : "text-[var(--text-muted)]"
                      }`}>{s.rank || i + 1}</span>
                      <span className="flex-1 text-sm truncate">{s.name}</span>
                      {s.price && s.price !== "-" && (
                        <span className="text-xs text-[var(--text-muted)] shrink-0 w-16 text-right">{s.price}</span>
                      )}
                      <span className={`text-xs shrink-0 w-24 text-right ${
                        (s.change || "").includes("▲") ? "text-[#ff4444]" :
                        (s.change || "").includes("▼") ? "text-[#44dd44]" :
                        "text-[var(--text-muted)]"
                      }`}>{s.change || "-"}</span>
                      {s.volume && (
                        <span className="text-[10px] text-[var(--text-muted)] shrink-0 w-20 text-right hidden md:inline">{s.volume}</span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--warning)]">※ 데이터 출처</strong> — Naver Finance (stock.naver.com)
          · 실시간 지연 데이터 · Puppeteer 크롤링 · 1시간 캐시
        </p>
        <div className="flex items-center gap-3 pt-1 border-t border-[var(--border)]">
          <a href="https://github.com/gameworkerkim/vibe-investing" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent-glow)] hover:underline">github.com/gameworkerkim/vibe-investing</a>
          <span className="text-[var(--border)]">|</span>
          <a href="https://stock.naver.com" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]">stock.naver.com</a>
        </div>
      </div>
    </div>
  );
}
