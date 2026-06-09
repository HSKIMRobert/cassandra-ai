"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Search } from "lucide-react";

interface Props {
  onSelect?: (query: string) => void;
}

export default function TrendingSearches({ onSelect }: Props) {
  const [items, setItems] = useState<{ query: string; count: number }[]>([]);

  useEffect(() => {
    const fetchTrending = () => {
      fetch("/api/trending")
        .then((r) => r.json())
        .then(setItems)
        .catch(() => {});
    };
    fetchTrending();
    const iv = setInterval(fetchTrending, 30000);
    return () => clearInterval(iv);
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-[var(--accent-glow)]" />
          <span className="text-xs font-semibold">실시간 검색어</span>
        </div>
        <p className="text-[10px] text-[var(--text-muted)]">검색 데이터 수집 중...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 sticky top-0 bg-[var(--surface)] rounded-t-xl z-10">
        <TrendingUp className="w-4 h-4 text-[var(--accent-glow)]" />
        <span className="text-xs font-semibold text-[var(--text)]">실시간 검색어</span>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">24시간</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {items.map((item, i) => (
          <button
            key={item.query}
            onClick={() => onSelect?.(item.query)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--border)]/40 transition-colors text-left"
          >
            <span
              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i === 0 ? "bg-[var(--danger)]/20 text-[var(--danger-glow)]" :
                i <= 2 ? "bg-[var(--accent)]/20 text-[var(--accent-glow)]" :
                "text-[var(--text-muted)]"
              }`}
            >
              {i + 1}
            </span>
            <span className="text-sm truncate flex-1">{item.query}</span>
            <span className="text-[10px] text-[var(--text-muted)] shrink-0 flex items-center gap-0.5">
              <Search className="w-2.5 h-2.5" />
              {item.count}
            </span>
          </button>
        ))}
        {/* 지식베이스 고정 항목 */}
        <button
          onClick={() => onSelect?.("씨그널엔터 김준범")}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--danger)]/10 transition-colors text-left border-t border-[var(--border)]"
        >
          <span className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 bg-[var(--danger)]/20 text-[var(--danger-glow)]">!</span>
          <span className="text-sm truncate flex-1 text-[var(--danger-glow)]">씨그널엔터 김준범</span>
          <span className="text-[10px] text-[var(--danger-glow)] shrink-0">🔍</span>
        </button>
      </div>
    </div>
  );
}
