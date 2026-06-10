"use client";

import { useState, useRef } from "react";
import { Search, User, Loader2, CheckCircle2, Circle, ExternalLink } from "lucide-react";

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
  const [progress, setProgress] = useState<string[]>([]);
  const [longWait, setLongWait] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = async (doScrape = false) => {
    if (!name.trim()) return;
    if (doScrape) setScraping(true);
    else setLoading(true);
    setResults(null);
    setLongWait(false);
    const steps: string[] = [];

    // 5초 지연 감지
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setLongWait(true), 5000);

    if (!doScrape) {
      steps.push("🔍 DB 캐시 검색 중...");
      setProgress([...steps]);
    }

    const res = await fetch("/api/person-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), period, scrape: doScrape }),
    });
    const data = await res.json();
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLongWait(false);

    if (!doScrape) {
      steps.push(data.totalResults > 0 ? `✅ ${data.totalResults}건 발견` : "❌ DB에서 결과 없음");
      if (data.canScrape) steps.push("💡 DART 웹사이트에서 추가 검색 가능");
    }
    setProgress(steps);
    setResults(data);
    setLoading(false);
    setScraping(false);
  };

  const handleScrape = async () => {
    setScraping(true);
    setLongWait(false);
    setProgress([
      "🚀 GitHub Actions로 DART 검색 요청 전송...",
      "⏳ Puppeteer가 DART 웹사이트를 검색 중입니다",
      "⏳ 최대 5분 내 정보가 갱신됩니다",
    ]);

    try {
      await fetch("https://api.github.com/repos/gameworkerkim/cassandra-ai/actions/workflows/person-scrape.yml/dispatches", {
        method: "POST",
        headers: { "Accept": "application/vnd.github+json" },
        body: JSON.stringify({ ref: "main", inputs: { name: name.trim(), period: String(period) } }),
      });
    } catch {}

    // 90초 후 결과 재조회
    setTimeout(async () => {
      setProgress(prev => [...prev, "📥 GitHub Actions 결과 확인 중..."]);
      const res = await fetch("/api/person-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), period: 12, scrape: true }),
      });
      const data = await res.json();
      setProgress(prev => [...prev, data.totalResults > 0 ? "✅ 검색 완료" : "⚠️ 결과를 찾지 못했습니다"]);
      setResults(data);
      setScraping(false);
    }, 90000);
  };

  return (
    <div className="space-y-6">
      <div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 메인</a>
        <h1 className="text-xl font-bold mt-2 flex items-center gap-2"><User className="w-5 h-5" /> 인명 검색</h1>
        <p className="text-xs text-[var(--text-muted)]">DB 캐시 + DART 지분공시 + GitHub Actions 스크래핑</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="인물명 입력 (예: 신승수, 김호진)"
            className="w-full h-12 pl-10 pr-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button key={p.months} onClick={() => setPeriod(p.months)}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${period === p.months ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] border border-[var(--border)]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={() => handleSearch()} disabled={loading}
          className="h-12 px-6 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
        </button>
      </div>

      {/* 검색 진행 상황 */}
      {progress.length > 0 && (
        <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
          {progress.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* 지연 경고 */}
      {longWait && (
        <div className="p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-xs text-[var(--warning)]">
          <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
          검색이 지연되고 있습니다. Neon DB 콜드 스타트(최대 10초) 후 결과가 표시됩니다.
        </div>
      )}

      {/* 결과 */}
      {results && (
        <div className="space-y-4">
          {results.canScrape && (
            <div className="p-4 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-center">
              <p className="text-xs text-[var(--warning)] mb-3">DB 캐시에 없는 인물입니다. DART 웹사이트에서 직접 검색할까요?</p>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-xs text-[var(--text-muted)]">검색 기간:</span>
                {PERIODS.map((p) => (
                  <button key={p.months} onClick={() => setPeriod(p.months)} disabled={scraping}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${period === p.months ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] border border-[var(--border)]"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <button onClick={handleScrape} disabled={scraping}
                className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
                {scraping ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 최대 5분 내 정보 갱신 중...</span>
                  : `DART 공시통합검색에서 ${PERIODS.find(p => p.months === period)?.label}간 찾기`}
              </button>
              {scraping && (
                <p className="text-[10px] text-[var(--text-muted)] mt-2">
                  <ExternalLink className="w-3 h-3 inline" />{" "}
                  <a href="https://github.com/gameworkerkim/cassandra-ai/actions/workflows/person-scrape.yml" target="_blank" className="underline">
                    GitHub Actions 진행 상황 보기
                  </a>
                </p>
              )}
            </div>
          )}

          <div className="text-sm text-[var(--text-muted)]">
            총 {results.totalResults || 0}건 발견
            {results.filings?.some((f: any) => f.source === "DART 스크래핑") && " (DART 웹사이트 스크래핑 결과 포함)"}
          </div>

          {results.persons?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">등록 인물</h3>
              {results.persons.map((p: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.birthDate && <span className="text-xs text-[var(--text-muted)] font-mono">{p.birthDate}</span>}
                    {p.flags?.includes("stock_celebrity") && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--danger)]/10 text-[var(--danger-glow)]">주식셀럽</span>}
                    {p.sameNameCount > 1 && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--warning)]/10 text-[var(--warning)]">동명이인 {p.sameNameCount}명</span>}
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

          {results.filings?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold">공시/이력</h3>
              {results.filings.map((f: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{f.companyName}</span>
                    <span className="text-[10px] text-[var(--text-muted)]">{f.source || ""} {f.totalFilings}건</span>
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
    </div>
  );
}
