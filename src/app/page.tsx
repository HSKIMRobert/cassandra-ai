"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, Building2, User, Landmark, AlertTriangle, TrendingDown, ShieldAlert, ExternalLink, X, Pin } from "lucide-react";
import dynamic from "next/dynamic";
import TrendingSearches from "@/components/TrendingSearches";
import PersonSearchRank from "@/components/PersonSearchRank";
import PinboardPanel from "@/components/PinboardPanel";
import VoteWidget from "@/components/VoteWidget";
import ChatPanel from "@/components/ChatPanel";
import { usePinboardStore } from "@/lib/pinboard-store";
import type { NodeDetail } from "@/components/EntityGraph";

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
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [cacheStale, setCacheStale] = useState(false);
  const [disclosureSummary, setDisclosureSummary] = useState<any[] | null>(null);
  const [personResults, setPersonResults] = useState<any[] | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [knowledgePopup, setKnowledgePopup] = useState<any>(null);

  const doSearch = useCallback(async (q: string, force = false) => {
    if (!q.trim()) {
      setGraphData(null);
      setSelectedNode(null);
      setPersonResults(null);
      setDisclosureSummary(null);
      setCacheAge(null);
      setCacheStale(false);
      return;
    }
    setLoading(true);
    setSelectedNode(null);
    const params = new URLSearchParams({ q });
    if (force) params.set("refresh", "1");
    const graphRes = await fetch(`/api/graph?${params}`).then((r) => r.json());
    setGraphData(graphRes);
    if (graphRes.filings) setDisclosureSummary(graphRes.filings);
    else setDisclosureSummary(null);

    // 인물 검색 결과
    const searchRes = await fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json());
    if (searchRes.persons?.length > 0) setPersonResults(searchRes.persons);
    else setPersonResults(null);
    if (searchRes.knowledge?.length > 0) setKnowledgePopup(searchRes.knowledge[0]);

    if (graphRes.cached) {
      setCacheAge(graphRes.cacheAge || 0);
      setCacheStale(graphRes.cacheStale || false);
    } else { setCacheAge(null); setCacheStale(false); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  useEffect(() => {
    const handler = (e: Event) => {
      const q = (e as CustomEvent).detail;
      setQuery(q);
      doSearch(q);
    };
    window.addEventListener("search", handler);
    return () => window.removeEventListener("search", handler);
  }, [doSearch]);

  useEffect(() => {
    fetch("/api/trending").then((r) => r.json()).then((trending) => {
      if (trending.length > 0) {
        setQuery(trending[0].query);
        doSearch(trending[0].query);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  const handleNodeSelect = useCallback(async (node: NodeDetail | null) => {
    if (!node) {
      setSelectedNode(null);
      return;
    }
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ type: node.type, name: node.label });
      if ((node as any).uid) params.set("uid", (node as any).uid);
      const res = await fetch(`/api/detail?${params}`);
      const detail = await res.json();
      if (!detail.error) setSelectedNode(detail);
    } catch {}
    setDetailLoading(false);
  }, []);

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
        {cacheStale && (
          <button
            onClick={() => doSearch(query, true)}
            className="h-14 px-4 rounded-xl bg-[var(--warning)]/20 border border-[var(--warning)]/30 text-[var(--warning)] text-xs hover:bg-[var(--warning)]/30 transition-colors shrink-0"
          >
             72시간 경과<br />추가 검색?
          </button>
        )}
        {cacheAge !== null && !cacheStale && (
          <span className="text-[10px] text-[var(--text-muted)] self-center">{cacheAge}분 전 캐시</span>
        )}
      </div>

      {/* 실시간 검색어 + 메인 콘텐츠 */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* 왼쪽 사이드바 */}
        <div className="lg:col-span-1 space-y-4">
          <TrendingSearches onSelect={(q) => { setQuery(q); doSearch(q); }} />
          <PersonSearchRank onSelect={(q) => { setQuery(q); doSearch(q); }} />
          <PinboardPanel />
        </div>

        {/* 중앙: 그래프 + 공시 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 그래프 */}
          <div className="relative rounded-xl border border-[var(--border)] overflow-hidden">
            {graphData && graphData.nodes.length > 0 ? (
              <EntityGraph data={graphData} onNodeSelect={handleNodeSelect} />
            ) : (
              <div className="w-full h-[450px] flex items-center justify-center bg-[var(--surface)] text-[var(--text-muted)]">
                {query ? "검색 결과가 없습니다" : "회사명을 입력하여 관계망을 탐색하세요"}
              </div>
            )}
            <div className="absolute bottom-4 left-4 flex gap-3 text-xs bg-[var(--surface)]/90 rounded-lg px-3 py-2 border border-[var(--border)]">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--corp-color)]" /><span>회사</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--person-color)]" /><span>인물</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--fund-color)]" /><span>법인/조합</span></div>
            </div>
          </div>

          {/* 선택한 노드 상세 정보 */}
          {detailLoading && (
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중...
            </div>
          )}
          {selectedNode && !detailLoading && (
            <NodeDetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
          )}
        </div>
          </div>

          {/* 인물 검색 결과 */}
          {personResults && personResults.length > 0 && (
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
              <div className="px-4 py-2 border-b border-[var(--border)] text-xs font-semibold">
                👤 인물 검색 결과 ({personResults.length}명)
              </div>
              <div className="grid gap-2 p-3 md:grid-cols-2">
                {personResults.map((p: any, i: number) => (
                  <a key={i} href={`/person/${p.personUid}`} className="p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.flags?.includes('stock_celebrity') && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--danger)]/10 text-[var(--danger-glow)]">주식셀럽</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
                      <span>{p._count?.corpRelations || 0}개 회사</span>
                      {p.birthDate && <span>· {p.birthDate}</span>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 공시 분석 */}
          {disclosureSummary && disclosureSummary.length > 0 && (
            <DisclosureAnalysis filings={disclosureSummary} />
          )}

        </div>

        {/* 우측: DART 챗봇 */}
        <div className="lg:col-span-1">
          <ChatPanel />
        </div>
      </div>

      {/* 법적 고지 */}
      <LegalDisclaimer />

      {/* 지식베이스 팝업 */}
      {knowledgePopup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setKnowledgePopup(null)}>
          <div className="w-full max-w-lg rounded-xl bg-[var(--bg)] border border-[var(--border)] p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--danger-glow)]" />
                <h3 className="text-lg font-bold">{knowledgePopup.name}</h3>
              </div>
              <button onClick={() => setKnowledgePopup(null)} className="p-1 rounded hover:bg-[var(--border)] text-[var(--text-muted)]">✕</button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {knowledgePopup.flags?.map((f: string) => (
                <span key={f} className="px-2 py-0.5 rounded text-[10px] bg-[var(--danger)]/10 text-[var(--danger-glow)] border border-[var(--danger)]/20">{f}</span>
              ))}
            </div>

            <p className="text-sm text-[var(--text)] leading-relaxed">{knowledgePopup.context}</p>

            {knowledgePopup.news?.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] text-[var(--text-muted)] uppercase">관련 뉴스</h4>
                {knowledgePopup.news.map((n: any, i: number) => (
                  <a
                    key={i}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-sm text-[var(--accent-glow)] hover:underline"
                  >
                    📰 {n.title}
                  </a>
                ))}
              </div>
            )}

            <button
              onClick={() => setKnowledgePopup(null)}
              className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NodeDetailPanel({ node, onClose }: { node: NodeDetail; onClose: () => void }) {
  const isPerson = node.type === "person";
  const isBlacklisted = node.flags?.includes("stock_celebrity");
  const { addItem, removeItem, hasItem } = usePinboardStore();
  const nodeId = `${node.type}-${node.label}`;
  const isPinned = hasItem(nodeId);

  const handlePin = () => {
    if (isPinned) {
      removeItem(nodeId);
    } else {
      const uid = (node as any).personUid || (node as any).fundUid || (node as any).corpCode || node.label;
      addItem({ id: nodeId, type: node.type as "corp" | "person" | "fund", label: node.label, uid });
    }
  };

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isPerson ? "bg-[var(--person-color)]" : "bg-[var(--fund-color)]"}`} />
          <span className="font-bold">{node.label}</span>
          {isBlacklisted && <AlertTriangle className="w-4 h-4 text-[var(--danger-glow)]" />}
          <span className="text-xs text-[var(--text-muted)]">
            {isPerson ? "인물" : node.flags?.includes("shell") ? "페이퍼컴퍼니" : "법인/조합"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePin}
            className={`p-1.5 rounded text-xs font-medium transition-colors ${
              isPinned
                ? "bg-[var(--accent)]/20 text-[var(--accent-glow)]"
                : "hover:bg-[var(--border)] text-[var(--text-muted)]"
            }`}
            title={isPinned ? "핀 해제" : "핀 고정"}
          >
            <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} />
          </button>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--border)]"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="p-4">
        {/* 생년월일 + 약력 */}
        {(node as any).birthDate && (
          <div className="flex items-center gap-3 mb-3 text-xs">
            <span className="text-[var(--text-muted)]">생년월일</span>
            <span className="font-mono text-[var(--accent-glow)]">{(node as any).birthDate}</span>
            {(node as any).sameNameCount > 1 && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)] text-[10px]">
                동명이인 {(node as any).sameNameCount}명
              </span>
            )}
          </div>
        )}
        {(node as any).bio && (
          <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed border-l-2 border-[var(--border)] pl-3 py-1">
            {(node as any).bio}
          </p>
        )}

        {/* 플래그 + 연관도 통계 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {node.flags?.map((f: string) => (
            <span key={f} className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              f === "stock_celebrity" ? "bg-[var(--danger)]/20 text-[var(--danger-glow)]" :
              f === "manipulation_suspect" || f === "delisting_related" ? "bg-[var(--warning)]/20 text-[var(--warning)]" :
              "bg-[var(--border)] text-[var(--text-muted)]"
            }`}>{f}</span>
          ))}
          <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--accent)]/10 text-[var(--accent-glow)]">
            총 연관 {node.totalConnections}건
          </span>
          {node.suspiciousCorps > 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--danger)]/10 text-[var(--danger-glow)]">
              ⚠ 문제기업 {node.suspiciousCorps}건
            </span>
          )}
        </div>

        {/* 집단 평가 투표 */}
        <VoteWidget
          entityType={node.type as "person" | "fund" | "corp"}
          entityUid={(node as any).personUid || (node as any).fundUid || node.label}
          entityName={node.label}
        />

        {/* 참여 기업 목록 */}
        {node.corpRelations?.length > 0 && (
          <div className="mb-4">
            <h5 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {isPerson ? "등기·관여 기업" : "투자·인수 기업"} ({node.corpRelations.length})
            </h5>
            <div className="grid gap-1.5 md:grid-cols-2">
              {node.corpRelations.map((rel: any, i: number) => (
                <a
                  key={i}
                  href={`/corp/${rel.corp.corpCode}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg)] hover:bg-[var(--border)]/30 transition-colors group"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium truncate">{rel.corp.companyName}</span>
                    {rel.corp.isAdmin && <ShieldAlert className="w-3 h-3 text-[var(--danger-glow)] shrink-0" />}
                    {rel.corp.delistedAt && <TrendingDown className="w-3 h-3 text-[var(--danger)] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">{rel.role}</span>
                    <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* 실소유 법인 (인물인 경우) */}
        {isPerson && (node.fundRelations as any[])?.length > 0 && (
          <div className="mb-4">
            <h5 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1.5">
              <Landmark className="w-3.5 h-3.5" /> 실소유·대표 법인 ({(node.fundRelations as any[]).length})
            </h5>
            <div className="grid gap-1.5 md:grid-cols-2">
              {(node.fundRelations as any[]).map((rel: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg)]">
                  <span className="text-xs">{rel.fund.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">
                    {rel.role === "BENEFICIAL_OWNER" ? "실소유" : "대표"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 실소유자 (법인인 경우) */}
        {!isPerson && (node.personRelations as any[])?.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> 실소유·대표 ({(node.personRelations as any[]).length})
            </h5>
            <div className="grid gap-1.5 md:grid-cols-2">
              {(node.personRelations as any[]).map((rel: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--bg)]">
                  <span className="text-xs">{rel.person.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--border)]">
                    {rel.role === "BENEFICIAL_OWNER" ? "실소유" : "대표"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DisclosureAnalysis({ filings }: { filings: any[] }) {
  const cats: Record<string, { count: number; items: any[] }> = {};
  const risks: string[] = [];

  filings.forEach((f: any) => {
    const t = f.title;
    let cat = '기타';
    if (/소송|판결|가처분|회생/.test(t)) { cat = '⚖️ 소송/분쟁'; if (!risks.includes('경영권 분쟁')) risks.push('경영권 분쟁'); }
    else if (/합병/.test(t)) { cat = '🔄 합병'; if (!risks.includes('합병/구조조정')) risks.push('합병/구조조정'); }
    else if (/주주총회|주주명부|의결권/.test(t)) { cat = '📋 주주총회'; if (!risks.includes('주주총회 빈번')) risks.push('주주총회 빈번'); }
    else if (/증자|감자|병합/.test(t)) { cat = '💰 자본변동'; if (!risks.includes('자본변동')) risks.push('자본변동'); }
    else if (/대량보유|주요주주|소유/.test(t)) { cat = '📊 지분공시'; if (!risks.includes('주요주주 변동')) risks.push('주요주주 변동'); }
    else if (/사채|CB|차입/.test(t)) { cat = '💳 자금조달'; }
    else if (/매매.*정지/.test(t)) { cat = '🛑 매매정지'; if (!risks.includes('매매정지')) risks.push('매매정지'); }
    if (!cats[cat]) cats[cat] = { count: 0, items: [] };
    cats[cat].count++;
    cats[cat].items.push(f);
  });

  const sorted = Object.entries(cats).sort((a, b) => b[1].count - a[1].count);
  const riskLevel = risks.length >= 3 ? 'HIGH' : risks.length >= 1 ? 'MEDIUM' : 'LOW';

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <span className="text-sm font-bold">📋 공시 분석 ({filings.length}건)</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          riskLevel === 'HIGH' ? 'bg-[var(--danger)]/20 text-[var(--danger-glow)]' :
          riskLevel === 'MEDIUM' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' :
          'bg-[var(--accent)]/10 text-[var(--accent-glow)]'
        }`}>위험도: {riskLevel}</span>
      </div>

      {/* 위험 신호 */}
      {risks.length > 0 && (
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <div className="flex flex-wrap gap-1.5">
            {risks.map((r, i) => (
              <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-[var(--danger)]/10 text-[var(--danger-glow)] border border-[var(--danger)]/20">
                ⚠ {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 카테고리 + 타임라인 */}
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
        {sorted.slice(0, 2).map(([cat, data]) => (
          <div key={cat} className="p-3">
            <h5 className="text-xs font-semibold mb-2">{cat} ({data.count}건)</h5>
            <div className="space-y-1 max-h-[150px] overflow-y-auto">
              {data.items.slice(0, 8).map((f: any, i: number) => (
                <div key={i} className="text-[10px] flex gap-2">
                  <span className="text-[var(--text-muted)] shrink-0">{f.date.slice(5)}</span>
                  <span className="truncate">{f.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegalDisclaimer() {
  return (
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
        <a href="https://github.com/gameworkerkim/vibe-investing" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent-glow)] hover:underline">
          github.com/gameworkerkim/vibe-investing
        </a>
        <span className="text-[var(--border)]">|</span>
        <a href="https://dart.fss.or.kr" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]">DART 전자공시</a>
        <span className="text-[var(--border)]">|</span>
        <a href="https://opendart.fss.or.kr" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]">OpenDART API</a>
      </div>
    </div>
  );
}
