"use client";

import { useState, useEffect } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";

const PERSONAS = [
    { id: "buffett", name: "워런 버핏", title: "가치 투자의 대가", avatar: "👴", color: "#22c55e", desc: "장기 가치 투자, 경제적 해자, 저평가 우량주" },
    { id: "wood", name: "캐시 우드", title: "혁신 기술의 선구자", avatar: "👩‍💼", color: "#a855f7", desc: "파괴적 혁신, AI·로보틱스·유전체 집중" },
    { id: "dalio", name: "레이 달리오", title: "올웨더 전략가", avatar: "🧓", color: "#f59e0b", desc: "거시경제 사이클, 리스크 패리티, 자산배분" },
];

const HOT_STOCKS = {
    KR: [
        { ticker: "005930", name: "삼성전자" },
        { ticker: "000660", name: "SK하이닉스" },
        { ticker: "035420", name: "NAVER" },
        { ticker: "035720", name: "카카오" },
        { ticker: "051910", name: "LG화학" },
        { ticker: "207940", name: "삼성바이오" },
    ],
    US: [
        { ticker: "NVDA", name: "엔비디아" },
        { ticker: "TSLA", name: "테슬라" },
        { ticker: "AAPL", name: "애플" },
        { ticker: "MSFT", name: "MS" },
        { ticker: "META", name: "메타" },
        { ticker: "PLTR", name: "팔란티어" },
    ],
    ETF: [
        { ticker: "QQQ", name: "나스닥100" },
        { ticker: "SOXL", name: "반도체3배" },
        { ticker: "TQQQ", name: "나스닥3배" },
        { ticker: "SCHD", name: "배당귀족" },
        { ticker: "JEPI", name: "커버드콜" },
    ],
};

export default function PersonaPage() {
    const [query, setQuery] = useState("");
    const [activePersona, setActivePersona] = useState("buffett");
    const [results, setResults] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [stockInfo, setStockInfo] = useState({ ticker: "", name: "" });
    const [precached, setPrecached] = useState(false);

    // 첫 방문 시 인기주식 프리캐싱
    const preCacheStocks = async () => {
        if (precached) return;
        setPrecached(true);
        fetch("/api/persona?precache=true").catch(() => {});
    };

    const analyze = async (ticker: string, name: string) => {
        setLoading(true);
        setStockInfo({ ticker, name });
        setResults({});
        try {
            const res = await fetch(`/api/persona?stock=${ticker}&name=${encodeURIComponent(name)}&persona=${activePersona}`);
            const data = await res.json();
            setResults({ [activePersona]: data });
        } catch {}
        setLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        analyze(query.trim().toUpperCase(), query.trim());
    };

    const handlePreset = (ticker: string, name: string) => {
        setQuery(ticker);
        analyze(ticker, name);
    };

    // 페이지 로드 시 프리캐싱 (인기주식 × 3페르소나)
    useEffect(() => { preCacheStocks(); }, []);

    const active = activePersona === "buffett" ? PERSONAS[0] : activePersona === "wood" ? PERSONAS[1] : PERSONAS[2];

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
            <div className="text-center">
                <h1 className="text-2xl font-bold">🎭 페르소나 투자 분석</h1>
                <p className="text-xs text-[var(--text-muted)] mt-1">워런 버핏 · 캐시 우드 · 레이 달리오의 시각으로 종목 분석</p>
            </div>

            {/* 페르소나 카드 */}
            <div className="grid grid-cols-3 gap-3">
                {PERSONAS.map(p => (
                    <button key={p.id} onClick={() => { setActivePersona(p.id); setResults({}); }}
                        className={`rounded-xl p-4 text-left transition-all border-2 ${activePersona === p.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/30"}`}>
                        <div className="text-3xl">{p.avatar}</div>
                        <h3 className="text-sm font-bold mt-2">{p.name}</h3>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{p.title}</p>
                        <p className="text-[9px] text-[var(--text-muted)] mt-1">{p.desc}</p>
                    </button>
                ))}
            </div>

            {/* 검색 */}
            <form onSubmit={handleSearch} className="flex gap-2">
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="티커 또는 종목명 입력 (NVDA, TSLA, 삼성전자...)"
                    className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm" />
                <button type="submit" className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium">
                    <Search className="w-4 h-4" />
                </button>
            </form>

            {/* 인기 종목 */}
            <div className="space-y-2">
                {Object.entries(HOT_STOCKS).map(([cat, stocks]) => (
                    <div key={cat} className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-[var(--text-muted)] w-8">{cat}</span>
                        {stocks.map(s => (
                            <button key={s.ticker} onClick={() => handlePreset(s.ticker, s.name)}
                                className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[10px] hover:border-[var(--accent)] hover:text-[var(--text)]">
                                {s.name}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            {/* 분석 중 */}
            {loading && (
                <div className="text-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--accent-glow)]" />
                    <p className="text-xs text-[var(--text-muted)] mt-2">{active.name}의 시각으로 {stockInfo.name} 분석 중...</p>
                </div>
            )}

            {/* 결과 */}
            {Object.values(results).filter(Boolean).length > 0 && (
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: active.color + "20" }}>
                            {active.avatar}
                        </div>
                        <div>
                            <h3 className="font-bold">{stockInfo.name} ({stockInfo.ticker})</h3>
                            <p className="text-[10px] text-[var(--text-muted)]">{active.name}의 {active.desc}</p>
                        </div>
                        {(results[activePersona] as any)?.fromCache && (
                            <span className="ml-auto text-[9px] text-[var(--text-muted)]">📦 Redis 캐시</span>
                        )}
                    </div>

                    {Object.entries(results).map(([k, r]: [string, any]) => (
                        <div key={k} className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="text-3xl font-bold" style={{ color: active.color }}>{r.score}점</div>
                                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                                    r.action === "BUY" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                                    r.action === "SELL" ? "bg-[#ef4444]/10 text-[#ef4444]" :
                                    "bg-[#f59e0b]/10 text-[#f59e0b]"}`}>
                                    {r.action === "BUY" ? <TrendingUp className="w-3 h-3 inline mr-1" /> :
                                     r.action === "SELL" ? <TrendingDown className="w-3 h-3 inline mr-1" /> :
                                     <Minus className="w-3 h-3 inline mr-1" />}
                                    {r.action === "BUY" ? "매수" : r.action === "SELL" ? "매도" : "관망"}
                                </div>
                            </div>
                            <p className="text-sm leading-relaxed">{r.summary}</p>
                            <blockquote className="border-l-2 pl-3 text-[10px] text-[var(--text-muted)] italic" style={{ borderColor: active.color }}>
                                {r.personaQuote}
                            </blockquote>
                        </div>
                    ))}
                </div>
            )}

            {/* 페르소나 설명 */}
            {!loading && Object.values(results).filter(Boolean).length === 0 && (
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ backgroundColor: active.color + "20" }}>{active.avatar}</div>
                        <div>
                            <h3 className="font-bold text-lg">{active.name}</h3>
                            <p className="text-xs text-[var(--text-muted)]">{active.title}</p>
                        </div>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">{active.desc}</p>
                    <blockquote className="mt-3 border-l-2 pl-3 text-xs text-[var(--text-muted)] italic" style={{ borderColor: active.color }}>
                        {PERSONAS.find(p => p.id === activePersona)?.desc}
                    </blockquote>
                    <p className="text-[10px] text-[var(--text-muted)] mt-4 text-center">상단에서 종목을 검색하거나 인기 종목을 선택해주세요</p>
                </div>
            )}
        </div>
    );
}
