"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, TrendingUp, FileText, Building2, Search, Loader2, ShieldAlert, ArrowUp, ArrowDown, Scale } from "lucide-react";

interface StockItem {
  rank: number;
  name: string;
  code: string;
  price: string;
  change: string;
  changePercent: number;
  volume?: string;
  marketCap?: string;
  flags?: {
    hasNameChange: boolean;
    hasMajorHolderChange: boolean;
    hasPurposeAddition: boolean;
    hasLawsuit: boolean;
    hasCB: boolean;
    cbCount: number;
    volatilityScore: number;
    nameChangeDetail?: string;
    holderChangeDetail?: string;
    lawsuitDetail?: string;
  };
}

const CATEGORIES = [
  { key: "name-changes", label: "사명 변경", icon: <FileText className="w-4 h-4" />, color: "border-l-[#ff4444]" },
  { key: "major-holder-changes", label: "대주주 변경", icon: <ShieldAlert className="w-4 h-4" />, color: "border-l-[var(--warning)]" },
  { key: "lawsuits", label: "소송·분쟁", icon: <Scale className="w-4 h-4" />, color: "border-l-[var(--danger-glow)]" },
  { key: "cb-issuances", label: "CB 발행", icon: <TrendingUp className="w-4 h-4" />, color: "border-l-[var(--accent-glow)]" },
  { key: "high-volatility", label: "고변동성 (≥30)", icon: <AlertTriangle className="w-4 h-4" />, color: "border-l-[#ff4444]" },
];

const DART_SECTIONS = [
  { key: "dart-nameChanges-12m", label: "DART 사명변경", file: "dart-nameChanges-12m" },
  { key: "dart-majorHolderChanges-12m", label: "DART 대주주변경", file: "dart-majorHolderChanges-12m" },
  { key: "dart-purposeAdditions-12m", label: "DART 사업목적추가", file: "dart-purposeAdditions-12m" },
  { key: "dart-lawsuits-12m", label: "DART 소송/분쟁", file: "dart-lawsuits-12m" },
];

export default function DashboardPage() {
  const [allStocks, setAllStocks] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<Record<string, StockItem[]>>({});
  const [dartSections, setDartSections] = useState<Record<string, any>>({});
  const [dartCounts, setDartCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/kosdaq-data?file=kosdaq-anomaly-report").then((r) => r.json()),
      ...CATEGORIES.map((c) => fetch(`/api/kosdaq-data?file=kosdaq-${c.key}`).then((r) => r.json())),
      ...DART_SECTIONS.map((d) => fetch(`/api/kosdaq-data?file=${d.file}`).then((r) => r.json())),
    ]).then(([report, ...rest]) => {
      const catData = rest.slice(0, CATEGORIES.length);
      const dartData = rest.slice(CATEGORIES.length);
      setAllStocks(report.stocks || []);
      const catMap: Record<string, StockItem[]> = {};
      CATEGORIES.forEach((c, i) => { catMap[c.key] = Array.isArray(catData[i]) ? catData[i] : []; });
      setCategories(catMap);

      const dartMap: Record<string, any> = {};
      const counts: Record<string, number> = {};
      DART_SECTIONS.forEach((d, i) => {
        const data = dartData[i];
        dartMap[d.key] = data;
        counts[d.key] = data?.events || data?.data?.length || 0;
      });
      setDartSections(dartMap);
      setDartCounts(counts);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-glow)]" />
      </div>
    );
  }

  const filtered = searchQuery
    ? allStocks.filter((s) => s.name.includes(searchQuery) || s.code.includes(searchQuery))
    : allStocks;

  const activeData = activeTab === "all" ? filtered : (categories[activeTab] || []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">코스닥 이상 징후 대시보드</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            시총 5,000억 미만 100종목 · DART 실공시 매칭 · SPAC 제외
          </p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => { setActiveTab(cat.key); setSearchQuery(""); }}
            className={`p-4 rounded-xl border text-left transition-colors ${cat.color} ${
              activeTab === cat.key
                ? "bg-[var(--accent)]/10 border-[var(--accent)]"
                : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">{cat.icon}<span className="text-xs font-semibold">{cat.label}</span></div>
            <span className="text-2xl font-bold">{categories[cat.key]?.length || 0}</span>
            <span className="text-[10px] text-[var(--text-muted)] ml-1">건</span>
          </button>
        ))}
      </div>

      {/* DART 실공시 데이터 섹션 */}
      {Object.values(dartCounts).some((c) => c > 0) && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            📋 DART 12개월 실공시 데이터
            <span className="text-[10px] text-[var(--text-muted)] font-normal">(LLM 학습용)</span>
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {DART_SECTIONS.map((ds) => {
              const data = dartSections[ds.key];
              const events = data?.data || data?.events ? (data.data || []) : [];
              if (!events || events.length === 0) return null;
              return (
                <div key={ds.key} className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
                  <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
                    <span className="text-xs font-semibold">{ds.label}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{events.length}건</span>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto divide-y divide-[var(--border)]">
                    {events.slice(0, 30).map((e: any, i: number) => (
                      <div key={i} className="px-4 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--accent-glow)] font-medium">{e.companyName}</span>
                          <span className="text-[var(--text-muted)]">{e.date?.slice(0,4)}.{e.date?.slice(4,6)}.{e.date?.slice(6,8)}</span>
                        </div>
                        <p className="text-[var(--text-muted)] truncate mt-0.5">{e.reportName}</p>
                        {e.marketCap && <span className="text-[10px] text-[var(--text-muted)]">{e.marketCap}억</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 검색 + 탭 */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setActiveTab("all"); }}
            placeholder="종목명 검색..."
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          onClick={() => { setActiveTab("all"); setSearchQuery(""); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === "all" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          전체 ({allStocks.length})
        </button>
      </div>

      {/* 종목 리스트 */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="text-left px-4 py-3 w-8">#</th>
                <th className="text-left px-2 py-3">종목명</th>
                <th className="text-right px-2 py-3">현재가</th>
                <th className="text-right px-2 py-3">등락률</th>
                <th className="text-right px-2 py-3 hidden md:table-cell">시총</th>
                <th className="text-center px-2 py-3 w-16">변동성</th>
                <th className="text-left px-2 py-3">플래그</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {activeData.slice(0, 100).map((s, i) => {
                const f = s.flags;
                const isUp = s.changePercent > 0;
                return (
                  <tr key={s.code} className="hover:bg-[var(--border)]/20 transition-colors">
                    <td className="px-4 py-2.5 text-[var(--text-muted)]">{s.rank || i + 1}</td>
                    <td className="px-2 py-2.5">
                      <a href={`/?q=${encodeURIComponent(s.name)}`} className="font-medium hover:text-[var(--accent-glow)] transition-colors">
                        {s.name}
                      </a>
                      <span className="text-[var(--text-muted)] ml-1">{s.code}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right">{s.price}</td>
                    <td className={`px-2 py-2.5 text-right font-medium ${isUp ? "text-[#ff4444]" : "text-[#44dd44]"}`}>
                      {isUp ? <ArrowUp className="w-3 h-3 inline mr-0.5" /> : <ArrowDown className="w-3 h-3 inline mr-0.5" />}
                      {Math.abs(s.changePercent).toFixed(1)}%
                    </td>
                    <td className="px-2 py-2.5 text-right text-[var(--text-muted)] hidden md:table-cell">{s.marketCap || "-"}</td>
                    <td className="px-2 py-2.5 text-center">
                      {f && f.volatilityScore > 0 ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          f.volatilityScore >= 50 ? "bg-[var(--danger)]/20 text-[var(--danger-glow)]" :
                          f.volatilityScore >= 30 ? "bg-[var(--warning)]/20 text-[var(--warning)]" :
                          "bg-[var(--accent)]/10 text-[var(--accent-glow)]"
                        }`}>{f.volatilityScore}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex gap-1 flex-wrap">
                        {f?.hasNameChange && <span className="px-1 py-0.5 rounded bg-[#ff4444]/10 text-[#ff4444] text-[9px]">사명</span>}
                        {f?.hasMajorHolderChange && <span className="px-1 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)] text-[9px]">대주주</span>}
                        {f?.hasLawsuit && <span className="px-1 py-0.5 rounded bg-[var(--danger)]/10 text-[var(--danger-glow)] text-[9px]">소송</span>}
                        {f?.hasCB && <span className="px-1 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent-glow)] text-[9px]">CB{f.cbCount > 1 ? f.cbCount : ""}</span>}
                        {f?.hasPurposeAddition && <span className="px-1 py-0.5 rounded bg-[var(--person-color)]/10 text-[var(--person-color)] text-[9px]">사업</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--warning)]">※ 데이터 출처</strong> — Naver Finance API (시세) + DART OpenAPI (공시)
          · SPAC 제외 · 시총 5,000억 미만 · 변동성 점수 = 사명(25) + 대주주(20) + 소송(25) + CB(5~15) + 사업목적(15) + 증자/감자(10)
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          데이터 갱신: <code className="text-[var(--accent-glow)]">npm run extract</code>
        </p>
      </div>
    </div>
  );
}
