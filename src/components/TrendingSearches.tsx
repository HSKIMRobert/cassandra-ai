"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp, Search } from "lucide-react";

interface TrendingItem {
  query: string;
  count: number;
}

export default function TrendingSearches() {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/trending")
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {});

    // 30초마다 갱신
    const iv = setInterval(() => {
      fetch("/api/trending")
        .then((r) => r.json())
        .then(setItems)
        .catch(() => {});
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // 자동 스크롤 애니메이션
  useEffect(() => {
    if (!scrollRef.current || items.length <= 3) return;
    const el = scrollRef.current;
    let animationId: number;
    let scrollPos = 0;
    const speed = 0.5; // px per frame

    const animate = () => {
      scrollPos += speed;
      if (scrollPos >= el.scrollHeight / 2) scrollPos = 0;
      el.scrollTop = scrollPos;
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [items]);

  if (items.length === 0) return null;

  // 3개 미만이면 복제해 스크롤 효과
  const displayItems = items.length <= 3 ? [...items, ...items, ...items] : items;

  return (
    <div className="relative rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[var(--accent-glow)]" />
        <span className="text-xs font-semibold text-[var(--accent-glow)]">실시간 검색어</span>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">24시간 기준</span>
      </div>
      <div
        ref={scrollRef}
        className="overflow-hidden"
        style={{ maxHeight: items.length <= 3 ? "auto" : "200px" }}
      >
        {displayItems.map((item, i) => (
          <a
            key={`${item.query}-${i}`}
            href={`/?q=${encodeURIComponent(item.query)}`}
            className="flex items-center gap-2 px-4 py-2 hover:bg-[var(--border)]/50 transition-colors text-sm"
            onClick={(e) => {
              e.preventDefault();
              // 홈 검색창에 값 설정은 window 이벤트로
              window.dispatchEvent(new CustomEvent("search", { detail: item.query }));
            }}
          >
            <span
              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                i < 3 ? "bg-[var(--accent)]/20 text-[var(--accent-glow)]" : "text-[var(--text-muted)]"
              }`}
            >
              {i + 1}
            </span>
            <span className="flex-1 truncate">{item.query}</span>
            <span className="text-[10px] text-[var(--text-muted)] shrink-0">
              <Search className="w-3 h-3 inline mr-0.5" />
              {item.count}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
