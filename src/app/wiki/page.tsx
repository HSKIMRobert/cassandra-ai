"use client";

import { useEffect, useState, useRef } from "react";
import { User, AlertTriangle, Building2, Send, ExternalLink, Loader2, Search, CheckCircle2 } from "lucide-react";

// ─── 인명검색 (person-search 탭용) ───
const PERIODS = [
  { label: "1년", months: 12 },
  { label: "3년", months: 36 },
  { label: "5년", months: 60 },
];

function PersonSearchTab() {
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
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="인물명 입력 (예: 신승수, 김호진)"
            className="w-full h-11 pl-10 pr-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
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
          className="h-11 px-5 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
        </button>
      </div>

      {progress.length > 0 && (
        <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1">
          {progress.map((step, i) => (
            <div key={i} className="text-xs">{step}</div>
          ))}
        </div>
      )}

      {longWait && (
        <div className="p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-xs text-[var(--warning)]">
          <Loader2 className="w-3 h-3 inline animate-spin mr-1" />
          검색이 지연되고 있습니다. Neon DB 콜드 스타트(최대 10초) 후 결과가 표시됩니다.
        </div>
      )}

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
                {scraping
                  ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> 최대 5분 내 정보 갱신 중...</span>
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
                      <a key={c.companyName} href={`/?q=${encodeURIComponent(c.companyName)}`}
                        className="px-2 py-0.5 rounded text-[10px] bg-[var(--accent)]/10 text-[var(--accent-glow)] hover:underline">
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

// ─── 메인 Wiki 탭 ───
function WikiTab() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/wiki").then((r) => r.json()).then(setData);
  }, []);

  const handleComment = async () => {
    if (!comment.trim() || !selected) return;
    setSaving(true);
    await fetch("/api/wiki", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: selected.name, field: "comment", value: comment }),
    });
    const res = await fetch("/api/wiki");
    setData(await res.json());
    setComment("");
    setSaving(false);
  };

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        {data.persons?.map((p: any) => (
          <button
            key={p.name}
            onClick={() => setSelected(p)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selected?.name === p.name ? "bg-[var(--accent)]/10 border-[var(--accent)]" : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{p.name}</span>
              {p.flags?.includes("stock_celebrity") && <AlertTriangle className="w-3.5 h-3.5 text-[var(--danger-glow)]" />}
            </div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {p.flags?.map((f: string) => (
                <span key={f} className="px-1.5 py-0.5 rounded text-[9px] bg-[var(--border)] text-[var(--text-muted)]">{f}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[var(--accent-glow)]" />
            <h2 className="text-lg font-bold">{selected.name}</h2>
            {selected.birthDate && <span className="text-xs text-[var(--text-muted)]">{selected.birthDate}</span>}
          </div>

          <p className="text-sm leading-relaxed">{selected.context}</p>

          <div>
            <h3 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">연관 기업</h3>
            <div className="flex flex-wrap gap-1">
              {selected.companies?.map((c: string) => (
                <a key={c} href={`/?q=${encodeURIComponent(c)}`} className="px-2 py-1 rounded text-xs bg-[var(--accent)]/10 text-[var(--accent-glow)] hover:underline flex items-center gap-1">
                  <Building2 className="w-3 h-3" />{c}
                </a>
              ))}
            </div>
          </div>

          {selected.patterns?.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">특이 패턴</h3>
              {selected.patterns.map((p: string, i: number) => (
                <div key={i} className="text-xs text-[var(--warning)]">• {p}</div>
              ))}
            </div>
          )}

          {selected.news?.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">관련 뉴스</h3>
              {selected.news.map((n: any, i: number) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-[var(--accent-glow)] hover:underline">
                  📰 {n.title} <ExternalLink className="inline w-3 h-3" />
                </a>
              ))}
            </div>
          )}

          <div>
            <h3 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">코멘트</h3>
            {selected.comments?.map((c: any, i: number) => (
              <div key={i} className="text-xs text-[var(--text-muted)] mb-1">
                <span className="text-[var(--text)]">{c.text}</span>
                <span className="ml-2 text-[10px]">{new Date(c.date).toLocaleDateString()}</span>
              </div>
            ))}
            <div className="flex gap-1 mt-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="코멘트 추가..."
                className="flex-1 px-2 py-1.5 rounded text-xs bg-[var(--bg)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
              />
              <button onClick={handleComment} disabled={saving} className="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-xs">
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 페이지 ───
export default function WikiPage() {
  const [tab, setTab] = useState<"wiki" | "person">("wiki");

  return (
    <div className="space-y-6">
      <div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 메인</a>
        <h1 className="text-xl font-bold mt-2">투자자 WIKI</h1>
        <p className="text-xs text-[var(--text-muted)]">주요 주주·투자자 정보 및 인명 검색</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        <button
          onClick={() => setTab("wiki")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === "wiki" ? "border-[var(--accent)] text-[var(--accent-glow)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          📚 투자자 WIKI
        </button>
        <button
          onClick={() => setTab("person")}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
            tab === "person" ? "border-[var(--accent)] text-[var(--accent-glow)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          <User className="w-3 h-3 inline mr-1" />인명 검색
        </button>
      </div>

      {tab === "wiki" ? <WikiTab /> : <PersonSearchTab />}
    </div>
  );
}
