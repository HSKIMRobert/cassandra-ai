"use client";

import { useEffect, useState } from "react";
import { Search, User, Building2, FileText, TrendingUp } from "lucide-react";

interface Props {
  onSelect?: (query: string) => void;
}

export default function PersonSearchRank({ onSelect }: Props) {
  const [items, setItems] = useState<{ query: string; count: number }[]>([]);

  useEffect(() => {
    fetch("/api/person-search")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {});
    const iv = setInterval(() => {
      fetch("/api/person-search").then((r) => r.json()).then(setItems).catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 sticky top-0 bg-[var(--surface)] rounded-t-xl z-10">
        <User className="w-4 h-4 text-[var(--danger-glow)]" />
        <span className="text-xs font-semibold text-[var(--text)]">인물 검색</span>
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {items.map((item, i) => (
          <button
            key={item.query}
            onClick={() => onSelect?.(item.query)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--border)]/40 transition-colors text-left"
          >
            <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
              i === 0 ? "bg-[var(--danger)]/20 text-[var(--danger-glow)]" : "text-[var(--text-muted)]"
            }`}>{i + 1}</span>
            <span className="text-sm truncate flex-1">{item.query}</span>
            <span className="text-[10px] text-[var(--text-muted)] shrink-0">{item.count}회</span>
          </button>
        ))}
      </div>
    </div>
  );
}
