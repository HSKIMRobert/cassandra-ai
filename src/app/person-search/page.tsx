"use client";

import { useState } from "react";
import { Search, User, Clock, FileText, Loader2 } from "lucide-react";

const PERIODS = [
  { label: "1년", months: 12 },
  { label: "3년", months: 36 },
  { label: "5년", months: 60 },
];

export default function PersonSearchPage() {
  const [name, setName] = useState("");
  const [period, setPeriod] = useState(12);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);

  const handleSearch = async (doScrape = false) => {
    if (!name.trim()) return;
    if (doScrape) setScraping(true);
    else setLoading(true);
    const res = await fetch("/api/person-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), period, scrape: doScrape }),
    });
    setResults(await res.json());
    setLoading(false);
    setScraping(false);
  };

  const handleScrape = async () => {
    setScraping(true);
    try {
      await fetch("https://api.github.com/repos/gameworkerkim/cassandra-ai/actions/workflows/person-scrape.yml/dispatches", {
        method: "POST",
        headers: { "Accept": "application/vnd.github+json" },
        body: JSON.stringify({ ref: "main", inputs: { name: name.trim(), period: String(period) } }),
      });
    } catch {}
    // 90초 후 재조회
    setTimeout(async () => {
      const res = await fetch("/api/person-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), period: 12, scrape: true }) }).then(r => r.json());
      if (res.error === "DOM_CHANGED" || res.totalResults === 0) {
        setResults({ ...res, domError: true });
      } else {
        setResults(res);
      }
      setScraping(false);
    }, 90000);
  };

  return (
    <div className="space-y-6">
      <div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 메인</a>
        <h1 className="text-xl font-bold mt-2 flex items-center gap-2">
          <User className="w-5 h-5" /> 인명 검색
        </h1>
        <p className="text-xs text-[var(--text-muted)]">DART 공시 본문에서 인물명 검색</p>
      </div>

      {/* 검색 바 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="인물명 입력 (예: 신승수, 오종원, 김준범)"
            className="w-full h-12 pl-10 pr-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.months}
              onClick={() => setPeriod(p.months)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                period === p.months ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => handleSearch()}
          disabled={loading}
          className="h-12 px-6 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
        </button>
      </div>

      {/* 결과 */}
      {results && (
        <div className="space-y-4">
          {results.domError && (
            <div className="p-4 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-center">
              <p className="text-sm text-[var(--danger-glow)] font-bold mb-1">⚠️ DART DOM 변경</p>
              <p className="text-xs text-[var(--danger-glow)]">관리자에게 알려주세요. (DART 웹사이트 구조가 변경되었습니다)</p>
            </div>
          )}

          {results.canScrape && (
            <div className="p-4 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-center">
              <p className="text-xs text-[var(--warning)] mb-3">
                DB 캐시에 없는 인물입니다. DART 공시통합검색에서 직접 찾아볼까요?
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">검색 기간:</span>
                {PERIODS.map((p) => (
                  <button
                    key={p.months}
                    onClick={() => setPeriod(p.months)}
                    disabled={scraping}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      period === p.months
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleScrape}
                disabled={scraping}
                className="mt-3 px-6 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {scraping ? (
                  <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> DART 웹사이트 검색 중 (약 1~2분 소요)...</span>
                ) : (
                  `DART 공시통합검색에서 ${PERIODS.find(p => p.months === period)?.label}간 찾기`
                )}
              </button>
            </div>
          )}

          <div className="text-sm text-[var(--text-muted)]">
            총 {results.totalResults || 0}건 발견
            {results.totalResults === 0 && !results.canScrape && " — 검색 결과가 없습니다"}
            {results.filings?.some((f: any) => f.source === "DART 스크래핑") && " (DART 웹사이트 스크래핑 결과 포함)"}
          </div>

          {/* DB 인물 */}
          {results.persons?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">등록 인물</h3>
              {results.persons.map((p: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.birthDate && <span className="text-xs text-[var(--text-muted)] font-mono">{p.birthDate}</span>}
                    {p.flags?.includes("stock_celebrity") && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--danger)]/10 text-[var(--danger-glow)]">주식셀럽</span>
                    )}
                    {p.sameNameCount > 1 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--warning)]/10 text-[var(--warning)]">동명이인 {p.sameNameCount}명</span>
                    )}
                  </div>
                  {p.bio && <p className="text-xs text-[var(--text-muted)] mt-1">{p.bio}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {p.companies?.map((c: any) => (
                      <a key={c.companyName} href={`/?q=${encodeURIComponent(c.companyName)}`} className="px-2 py-0.5 rounded text-[10px] bg-[var(--accent)]/10 text-[var(--accent-glow)] hover:underline">
                        🏢 {c.companyName} ({c.role})
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 공시 본문 검색 */}
          {results.filings?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold flex items-center gap-1">
                <FileText className="w-3 h-3" /> 공시 본문 언급
              </h3>
              {results.filings.map((f: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <a href={`/?q=${encodeURIComponent(f.companyName)}`} className="font-medium text-sm hover:text-[var(--accent-glow)]">
                      {f.companyName}
                    </a>
                    <span className="text-xs text-[var(--text-muted)]">{f.totalFilings}건</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {f.filings?.slice(0, 5).map((d: any, j: number) => (
                      <div key={j} className="text-[10px] flex gap-2">
                        <span className="text-[var(--text-muted)] shrink-0">{d.date}</span>
                        <span className="truncate">{d.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="p-4 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs text-[var(--text-muted)] text-center">
          인물명을 입력하고 검색 버튼을 클릭하세요
        </div>
      )}
    </div>
  );
}
