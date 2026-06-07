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
      <div className="max-w-2xl mx-auto flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch(query)}
            placeholder="회사명, 인물명, 법인명으로 검색..."
            className="w-full h-14 pl-12 pr-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)] text-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
          />
        </div>
        <button
          onClick={() => doSearch(query)}
          disabled={loading}
          className="h-14 px-6 rounded-xl bg-[var(--accent)] text-white font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          검색
        </button>
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

      {/* 법적 고지 */}
      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--warning)]">※ CASSANDRA AI</strong> —
          본 서비스는 금융감독원 전자공시시스템(DART)에 공시된 사실 정보를 색인·분석하여 제공하는
          <strong> 공익 목적의 이상 징후 탐지 도구</strong>입니다.
          특정 개인·법인에 대한 평가나 투자 권유가 아니며, 모든 데이터는 원본 공시(접수번호)로 역추적 가능합니다.
        </p>
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          본 서비스에서 제공되는 정보는 공시 제출인의 책임 하에 작성된 것으로 금융감독원이 그 정확성 및 완전성을 보장하지 않습니다.
          이용자는 본 정보를 투자 판단의 근거로 사용해서는 안 되며, 이를 위반하여 발생한 손실에 대해 서비스 제공자는
          민·형사상 어떠한 책임도 부담하지 않습니다. 제보된 정보는 이상 징후 패턴 학습 목적으로만 활용됩니다.
        </p>
        <div className="flex items-center gap-3 pt-1 border-t border-[var(--border)]">
          <a
            href="https://github.com/gameworkerkim/vibe-investing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--accent-glow)] hover:underline"
          >
            github.com/gameworkerkim/vibe-investing
          </a>
          <span className="text-[var(--border)]">|</span>
          <a
            href="https://dart.fss.or.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            DART 전자공시
          </a>
          <span className="text-[var(--border)]">|</span>
          <a
            href="https://opendart.fss.or.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            OpenDART API
          </a>
        </div>
      </div>
    </div>
  );
}
