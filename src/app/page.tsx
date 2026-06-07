"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import TrendingSearches from "@/components/TrendingSearches";
import BoardPage from "@/components/BoardPage";

const EntityGraph = dynamic(() => import("@/components/EntityGraph"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] flex items-center justify-center bg-[var(--surface)] rounded-xl border border-[var(--border)]">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
    </div>
  ),
});

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "board">("graph");

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setGraphData(null);
      return;
    }
    setLoading(true);
    const graphRes = await fetch(`/api/graph?q=${encodeURIComponent(q)}`).then((r) => r.json());
    setGraphData(graphRes);
    setLoading(false);
    setActiveTab("graph");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  // 실검 클릭 이벤트 수신
  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent).detail;
      setQuery(q);
      doSearch(q);
    };
    window.addEventListener("search", handler);
    return () => window.removeEventListener("search", handler);
  }, [doSearch]);

  // 초기 로드
  useEffect(() => {
    fetch("/api/trending").then((r) => r.json()).then((trending) => {
      if (trending.length > 0) {
        setQuery(trending[0].query);
        doSearch(trending[0].query);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  return (
    <div className="space-y-6">
      {/* 검색 바 */}
      <div className="relative max-w-2xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="회사명, 인물명, 법인명으로 검색..."
          className="w-full h-14 pl-12 pr-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)] text-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-[var(--accent-glow)]" />
        )}
      </div>

      {/* 실시간 검색어 + 메인 콘텐츠 */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* 사이드바: 실검 */}
        <div className="lg:col-span-1">
          <TrendingSearches />
        </div>

        {/* 메인 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 탭 */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("graph")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "graph"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              관계망 분석
            </button>
            <button
              onClick={() => setActiveTab("board")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "board"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              <MessageSquare className="w-4 h-4" /> 제보·분석요청
            </button>
          </div>

          {/* 그래프 뷰 */}
          {activeTab === "graph" && (
            <div className="relative rounded-xl border border-[var(--border)] overflow-hidden">
              {graphData && graphData.nodes.length > 0 ? (
                <EntityGraph data={graphData} />
              ) : (
                <div className="w-full h-[500px] flex items-center justify-center bg-[var(--surface)] text-[var(--text-muted)]">
                  {query ? "검색 결과가 없습니다" : "회사명을 입력하여 관계망을 탐색하세요"}
                </div>
              )}
              <div className="absolute bottom-4 left-4 flex gap-3 text-xs bg-[var(--surface)]/90 rounded-lg px-3 py-2 border border-[var(--border)]">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--corp-color)]" /><span>회사</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--person-color)]" /><span>인물</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--fund-color)]" /><span>법인/조합</span></div>
              </div>
            </div>
          )}

          {/* 게시판 뷰 */}
          {activeTab === "board" && <BoardPage />}
        </div>
      </div>

      {/* disclaimer */}
      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)]">
          <strong className="text-[var(--warning)]">※ CASSANDRA AI</strong> —
          본 정보는 DART 공시 사실의 색인이며 평가나 투자 권유가 아닙니다.
          모든 데이터 포인트는 원본 공시(rcept_no)로 역추적 가능합니다.
          제보된 정보는 이상 징후 패턴 학습에 활용됩니다.
        </p>
      </div>
    </div>
  );
}
