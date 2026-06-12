"use client";

import { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Share2, Copy, Eye, ExternalLink, AlertTriangle, BarChart3, Clock, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

const TOOLTIP_STYLE = { backgroundColor: "#1a1a2e", border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 12 };

// ─── 더미 데이터 (fallback) ───
const regimeData = [
  { date: "06/01", regime: 2 }, { date: "06/03", regime: 2 }, { date: "06/05", regime: 1 },
  { date: "06/07", regime: 2 }, { date: "06/09", regime: 2 }, { date: "06/11", regime: 3 },
];

const momentumData = [
  { date: "06/01", amqs: 100, m7: 102 }, { date: "06/03", amqs: 103, m7: 105 },
  { date: "06/05", amqs: 107, m7: 110 }, { date: "06/07", amqs: 112, m7: 118 },
  { date: "06/09", amqs: 108, m7: 114 }, { date: "06/11", amqs: 115, m7: 122 },
];

// AMQS-M7 개별 종목 (하드코딩 — 추후 API 연동)
const amqsStocks = [
  { name: "엔비디아", score: 92, weight: "25%", signal: "매수" },
  { name: "TSMC", score: 88, weight: "20%", signal: "매수" },
  { name: "SK하이닉스", score: 82, weight: "18%", signal: "매수" },
  { name: "삼성전자", score: 75, weight: "15%", signal: "매수" },
  { name: "ASML", score: 70, weight: "12%", signal: "관망" },
  { name: "AMD", score: 62, weight: "10%", signal: "관망" },
];

const ardsStocks = [
  { name: "AMQS-M7 Long", score: 65, signal: "매수", desc: "AI 반도체 모멘텀" },
  { name: "KOSDAQ150 인버스", score: 35, signal: "헤지", desc: "하락장 방어" },
  { name: "국고채 10년", score: 15, signal: "안전", desc: "무위험 자산" },
  { name: "금 현물", score: 10, signal: "안전", desc: "인플레이션 헤지" },
];

interface StockData {
  name: string; code: string; price: string; change: string; changePercent: number;
}

interface QuantResponse {
  generatedAt: string;
  marketGauge: { fear: number; neutral: number; greed: number };
  stocks: StockData[];
  fromCache?: boolean;
  cachedSecondsAgo?: number;
  stale?: boolean;
}

function buildRegimeStocks(stocks: StockData[]) {
  return stocks.map(s => {
    const delta = s.changePercent;
    let score = 50 + delta * 5; // base 50, ±등락
    score = Math.max(0, Math.min(100, Math.round(score)));
    const signal = delta > 1 ? "매수" : delta < -1 ? "매도" : "관망";
    const color = delta > 1 ? "#22c55e" : delta < -1 ? "#ef4444" : "#f59e0b";
    return { name: s.name, score, signal, color };
  });
}

export default function QuantDashboard() {
  const [visitors, setVisitors] = useState({ today: 0, total: 0 });
  const [copied, setCopied] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");
  const [quantPopup, setQuantPopup] = useState<string | null>(null);
  const [hookMsg, setHookMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 실시간 데이터
  const [regimeStocks, setRegimeStocks] = useState<{ name: string; score: number; signal: string; color: string }[]>([]);
  const [cacheInfo, setCacheInfo] = useState("");
  const [sectorData, setSectorData] = useState<{ marketAvg: number; marketStatus: string; sectors: any[] } | null>(null);
  const [muHynixData, setMuHynixData] = useState<{ prediction: any; backtest: any } | null>(null);

  const hookMessages = [
    "🚀 AI가 찾은 이번 주 유망 종목은?",
    "📉 하락장에서도 수익 내는 퀀트 전략",
    "🤖 LLM이 분석하는 시장 심리, 지금은?",
    "💡 개미털기 당하기 전에 확인하세요",
    "🔥 NASDAQ Top 100, AI가 보는 국면은?",
    "⚡ 엔비디아·테슬라·애플 — 퀀트 시그널",
    "🎯 이번 달 AMQS-M7 수익률 공개",
  ];

  const fetchQuantData = useCallback(async (force: boolean) => {
    setLoading(true);
    setError("");
    try {
      const url = force ? "/api/quant-data?force=true" : "/api/quant-data";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: QuantResponse = await res.json();

      if (data.stocks?.length) {
        setRegimeStocks(buildRegimeStocks(data.stocks));
      }

      setUpdatedAt(new Date(data.generatedAt).toLocaleString("ko-KR"));

      if (data.fromCache) {
        const min = Math.floor((data.cachedSecondsAgo || 0) / 60);
        const sec = (data.cachedSecondsAgo || 0) % 60;
        const staleTag = data.stale ? " (만료)" : "";
        setCacheInfo(`Redis 캐시${staleTag} · ${min}분 ${sec}초 전`);
      } else {
        setCacheInfo("실시간 · Naver Finance");
      }
    } catch (e: any) {
      setError(e.message || "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 방문 기록 + 통계 조회
    fetch("/api/pageview", { method: "POST", body: JSON.stringify({ path: "/quant" }) }).catch(() => {});
    fetch("/api/pageview").then(r => r.json()).then(d => {
      setVisitors({ today: d.today || 0, total: d.total || 0 });
    }).catch(() => {});
    setUpdatedAt(new Date().toLocaleString("ko-KR"));
    const count = 2 + Math.floor(Math.random() * 4);
    const shuffled = [...hookMessages].sort(() => Math.random() - 0.5);
    setHookMsg(shuffled.slice(0, count).join("\n"));
    fetchQuantData(false);
    // 섹터 공포·탐욕 지수
    fetch("/api/sector-fear-greed").then(r => r.json()).then(d => {
      if (d.sectors?.length) setSectorData(d);
    }).catch(() => {});
    // MU → 하이닉스 예측
    fetch("/api/mu-hynix").then(r => r.json()).then(d => {
      if (d.prediction || d.backtest) setMuHynixData(d);
    }).catch(() => {});
  }, []);

  const shareText = `📊 CASSANDRA AI — 퀀트 대시보드\n\nAI×퀀트로 분석하는 코스닥 시장\nARS-X·AMQS·ARDS 전략\n\nhttps://dart-monitor-pi.vercel.app/quant`;
  const handleCopy = () => { navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📊 CASSANDRA AI — 퀀트 대시보드</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">AI × 퀀트 × 미국 주식 × DART 공시 기반 코스닥 시장 분석</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Clock className="w-3 h-3" /> 데이터 갱신
          </div>
          <div className="text-xs text-[var(--accent-glow)]">{updatedAt}</div>
          <button
            onClick={() => fetchQuantData(true)}
            disabled={loading}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] mt-1 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> {loading ? "갱신 중..." : "새로고침"}
          </button>
          <div className="flex gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{visitors.today}</span>
            <span>누적 {visitors.total}</span>
          </div>
          <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{cacheInfo}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. 섹터별 공포·탐욕 지수 (시장 게이지 대체) */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <span className="text-lg">{sectorData ? (sectorData.marketAvg < 40 ? "🔥" : sectorData.marketAvg < 50 ? "😨" : sectorData.marketAvg < 60 ? "😐" : sectorData.marketAvg < 80 ? "😈" : "🤑") : "📊"}</span>
            섹터별 공포·탐욕 지수
            {sectorData && (
              <span className={`ml-1 text-[11px] ${sectorData.marketAvg < 40 ? "text-[#ef4444]" : sectorData.marketAvg < 60 ? "text-[var(--text-muted)]" : "text-[#22c55e]"}`}>
                (평균 {sectorData.marketAvg} — {sectorData.marketStatus})
              </span>
            )}
          </h2>
          {sectorData && sectorData.sectors.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {sectorData.sectors.map((s: any) => (
                  <div key={s.ticker} className="rounded bg-[var(--bg)] p-2 flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold" style={{ backgroundColor: s.color + "20", color: s.color }}>
                      {s.ticker}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold truncate">{s.name}</div>
                      <div className="mt-0.5 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, s.score)}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold" style={{ color: s.color }}>{s.score >= 0 ? s.score.toFixed(0) : "N/A"}</div>
                      <div className="text-[9px] text-[var(--text-muted)]">{s.emoji} {s.status}</div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-[var(--text-muted)] mt-2 text-right">
                Yahoo Finance · 10분 Redis 캐시 · 미국 장 마감 기준
              </p>
            </>
          ) : (
            <p className="text-[10px] text-[var(--text-muted)]">로딩 중...</p>
          )}
          <details className="mt-2 text-[9px] text-[var(--text-muted)]">
            <summary className="cursor-pointer hover:text-[var(--text)]">방법론</summary>
            <p className="mt-1">RSI(14)·MA20·변동성비율·섹터모멘텀vsSPY·거래량서지의 5개 시그널을 가중평균하여 0(공포)~100(탐욕) 점수 산출</p>
          </details>
        </div>

        {/* 2. MU → 하이닉스 예측 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <span className="text-lg">🔮</span> MU(마이크론) → 하이닉스 예측
            <span className="text-[9px] text-[var(--text-muted)] ml-1">미국장 종가 → 한국장 시가 예측</span>
          </h2>
          {muHynixData?.prediction ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="rounded bg-[var(--bg)] p-2">
                  <div className="text-[var(--text-muted)]">마이크론 (MU)</div>
                  <div className="text-lg font-bold mt-1">${muHynixData.prediction.muCurrentPrice}</div>
                  <div className={muHynixData.prediction.muChangePct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}>
                    {muHynixData.prediction.muChangePct >= 0 ? "▲" : "▼"} {Math.abs(muHynixData.prediction.muChangePct)}%
                  </div>
                </div>
                <div className="rounded bg-[var(--bg)] p-2">
                  <div className="text-[var(--text-muted)]">하이닉스 예측 시가 (000660)</div>
                  <div className="text-lg font-bold mt-1">₩{muHynixData.prediction.hynixPredictedOpen.toLocaleString()}</div>
                  <div className={muHynixData.prediction.hynixPredictedChangePct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}>
                    {muHynixData.prediction.hynixSignal} {muHynixData.prediction.hynixPredictedChangePct >= 0 ? "▲" : "▼"} {Math.abs(muHynixData.prediction.hynixPredictedChangePct)}%
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-2 text-[9px] text-[var(--text-muted)]">
                <span>β(베타): {muHynixData.prediction.beta}</span>
                <span>R²: {muHynixData.prediction.r2}</span>
                <span>n={muHynixData.prediction.dataPoints}</span>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-[var(--text-muted)]">로딩 중...</p>
          )}
          <details className="mt-2 text-[9px] text-[var(--text-muted)]">
            <summary className="cursor-pointer hover:text-[var(--text)]">14일 백테스트</summary>
            {(() => {
              const bt = muHynixData?.backtest;
              if (!bt || !bt.items?.length) return <p className="mt-1">데이터 쌓이는 중...</p>;
              return (
              <div className="mt-1 space-y-0.5">
                <div className="flex justify-between text-[var(--text-muted)] border-b border-[var(--border)] pb-0.5 mb-0.5">
                  <span className="w-16">날짜</span><span className="w-10">MU</span><span className="w-12">예측</span><span className="w-12">실제</span><span className="w-10">차이</span><span className="w-8">적중</span>
                </div>
                {bt.items.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-[9px]">
                    <span className="w-16">{b.date?.slice(5)}</span>
                    <span className={`w-10 ${b.muChangePct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{b.muChangePct}%</span>
                    <span className="w-12">₩{b.hynixPredicted?.toLocaleString()}</span>
                    <span className="w-12">{b.hynixActual ? `₩${b.hynixActual.toLocaleString()}` : "-"}</span>
                    <span className={`w-10 ${b.diffWon >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{b.diffWon != null ? `${b.diffWon >= 0 ? "+" : ""}${b.diffWon}원` : "-"}</span>
                    <span className={`w-8 text-center font-bold ${b.hit === true ? "text-[#22c55e]" : b.hit === false ? "text-[#ef4444]" : "text-[var(--text-muted)]"}`}>
                      {b.hit === true ? "✓" : b.hit === false ? "✗" : "-"}
                    </span>
                  </div>
                ))}
                <div className="border-t border-[var(--border)] pt-0.5 mt-0.5 flex justify-between text-[9px]">
                  <span>적중률: {bt.accuracy}%</span>
                  <span>{bt.totalHits}/{bt.totalEvaluated}</span>
                </div>
              </div>
            )})()}
          </details>
          <button onClick={() => setQuantPopup("muhynix")} className="mt-2 text-[10px] text-[var(--accent-glow)] hover:underline">
            📂 퀀트 원본 보기 (GitHub)
          </button>
        </div>

        {/* 3. ARDS-X Regime Classifier */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-[var(--accent-glow)]" /> 시장 국면 판단 (ARDS-X)</h2>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={regimeData}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 10, fill: "#888" }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#fff", fontWeight: 600 }} />
              <Line type="monotone" dataKey="regime" stroke="#6c5ce7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-[#ef4444]">0:하락</span><span className="text-[var(--text-muted)]">1:횡보</span><span className="text-[var(--accent-glow)]">2:상승</span><span className="text-[#22c55e]">3:급등</span>
          </div>

          {/* 개별 종목 평가 (실시간) */}
          <div className="mt-3">
            <h4 className="text-[10px] font-semibold text-[var(--text-muted)] mb-1">📊 개별 종목 시그널</h4>
            {loading && !regimeStocks.length ? (
              <p className="text-[10px] text-[var(--text-muted)]">로딩 중...</p>
            ) : regimeStocks.length > 0 ? (
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={regimeStocks} layout="vertical" margin={{ left: 90 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#888" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#e4e4f0" }} width={85} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: any) => [`${value}점`, "스코어"]}
                    labelStyle={{ color: "#fff", fontWeight: 600 }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {regimeStocks.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)]">데이터 없음</p>
            )}
          </div>

          <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
            <strong>ARDS-X</strong>는 NASDAQ Top 100의 변동성·거래량·모멘텀을 결합하여 시장 국면을 4단계로 분류합니다.
            상승 국면에서는 공격적 비중, 하락 국면에서는 현금 비중을 늘리는 전략을 제안합니다.
          </p>
          <button onClick={() => setQuantPopup("ardsx")} className="mt-2 text-[10px] text-[var(--accent-glow)] hover:underline">
            📂 퀀트 원본 보기 (GitHub)
          </button>
        </div>

        {/* 3. AMQS / AMQS-M7 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-[#22c55e]" /> AI 반도체 모멘텀 (AMQS / AMQS-M7)</h2>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={momentumData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#888" }} />
              <YAxis domain={[95, 130]} tick={{ fontSize: 9, fill: "#888" }} />
              <Tooltip contentStyle={{ ...TOOLTIP_STYLE, fontSize: 11 }} labelStyle={{ color: "#fff", fontWeight: 600 }} />
              <Line type="monotone" dataKey="amqs" stroke="#6c5ce7" strokeWidth={2} dot={false} name="AMQS" />
              <Line type="monotone" dataKey="m7" stroke="#22c55e" strokeWidth={2} dot={false} name="M7" />
            </LineChart>
          </ResponsiveContainer>

          <div className="mt-3 text-[10px]">
            <h4 className="font-semibold text-[var(--text-muted)] mb-1">📊 AMQS-M7 구성 종목</h4>
            <div className="space-y-1">
              {amqsStocks.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-1.5 rounded bg-[var(--bg)]">
                  <span>{s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">{s.weight}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] ${s.signal === "매수" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[var(--warning)]/10 text-[var(--warning)]"}`}>{s.signal}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
            <strong>AMQS (AI Momentum Quant Strategy)</strong>는 AI·반도체 섹터의 모멘텀을 추종하는 전략입니다.
            AMQS-M7은 상위 7개 종목(엔비디아·TSMC·SK하이닉스·삼성전자·ASML·AMD·퀄컴)에 집중 투자합니다.
          </p>
          <button onClick={() => setQuantPopup("amqs")} className="mt-2 text-[10px] text-[var(--accent-glow)] hover:underline">
            📂 퀀트 원본 보기 (GitHub)
          </button>
        </div>

        {/* 4. ARDS 헤지 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><TrendingDown className="w-4 h-4 text-[#ef4444]" /> 방어·헤지 (ARDS)</h2>

          <div className="text-[10px] space-y-1 mb-3">
            {ardsStocks.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-1.5 rounded bg-[var(--bg)]">
                <div>
                  <span>{s.name}</span>
                  <span className="text-[var(--text-muted)] ml-1">({s.desc})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{s.score}%</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] ${s.signal==="매수"?"bg-[#22c55e]/10 text-[#22c55e]":s.signal==="헤지"?"bg-[var(--warning)]/10 text-[var(--warning)]":"bg-[var(--accent)]/10 text-[var(--accent-glow)]"}`}>{s.signal}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
            <div className="p-2 rounded bg-[var(--bg)] text-center">
              <div className="text-[var(--text-muted)]">AMQS-M7</div><div className="font-bold">65%</div>
            </div>
            <div className="p-2 rounded bg-[var(--bg)] text-center">
              <div className="text-[var(--text-muted)]">헤지</div><div className="font-bold">25%</div>
            </div>
            <div className="p-2 rounded bg-[var(--bg)] text-center">
              <div className="text-[var(--text-muted)]">안전</div><div className="font-bold">10%</div>
            </div>
          </div>

          <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
            <strong>ARDS (AI Risk Diversification Strategy)</strong>는 AMQS-M7에 대한 대칭 헤지 전략입니다.
            비중은 Median + 15% Cap으로 관리되어 과도한 레버리지를 방지합니다.
          </p>
          <button onClick={() => setQuantPopup("ards")} className="mt-2 text-[10px] text-[var(--accent-glow)] hover:underline">
            📂 퀀트 원본 보기 (GitHub)
          </button>
        </div>
      </div>

      {/* 퀀트 원본 팝업 */}
      {quantPopup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setQuantPopup(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] rounded-xl bg-[var(--bg)] border border-[var(--border)] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">
                {quantPopup === "ardsx" ? "ARDS-X Regime Classifier" : quantPopup === "amqs" ? "AMQS / AMQS-M7" : quantPopup === "ards" ? "ARDS 헤지 전략" : "MU → 하이닉스 예측"}
              </h3>
              <button onClick={() => setQuantPopup(null)} className="p-1 rounded hover:bg-[var(--border)]">✕</button>
            </div>
            <div className="space-y-3 text-sm text-[var(--text-muted)]">
              <p>📂 원본 퀀트 전략은 GitHub에서 확인하세요:</p>
              <a href="https://github.com/gameworkerkim/vibe-investing/tree/main/01.Trading%20Strategy" target="_blank" className="text-[var(--accent-glow)] hover:underline block">
                github.com/gameworkerkim/vibe-investing/tree/main/01.Trading Strategy
              </a>
              <div className="bg-[var(--surface)] rounded-lg p-4 text-xs font-mono whitespace-pre-wrap">
                {quantPopup === "ardsx" && `# ARDS-X Regime Classifier\n# NASDAQ Top 100 기반 시장 국면 판단\n\nRegime 0: 하락 → 현금 비중 80% +\nRegime 1: 횡보 → 현금 50% + 롱 50%\nRegime 2: 상승 → 롱 80% + 현금 20%\nRegime 3: 급등 → 롱 100% (트레일링 스탑)\n\n지표: VIX, MA20/60, RSI(14), Volume SMA`}
                {quantPopup === "amqs" && `# AMQS (AI Momentum Quant Strategy)\n# AI·반도체 섹터 모멘텀 추종\n\nAMQS-M7 구성: NVDA, TSMC, SK Hynix, Samsung, ASML, AMD, QCOM\n리밸런싱: 월 1회 (매월 1일)\n비중: 동일가중 (Equal Weight) → 모멘텀 가중\n진입: 20일 모멘텀 > 5% → 매수\n청산: 20일 모멘텀 < -5% → 매도`}
                {quantPopup === "ards" && `# ARDS (AI Risk Diversification Strategy)\n# AMQS-M7 대칭 헤지 전략\n\nLong: AMQS-M7 (65%)\nHedge: KOSDAQ150 Inverse (25%)\nSafe: 국고채 10년 (10%)\n\n헤지 트리거: ARDS-X Regime = 0 (하락)\n비중 캡: Median + 15% (과도한 레버리지 방지)\n리밸런싱: 주 1회 (매주 월요일)`}
                {quantPopup === "muhynix" && `# MU → 하이닉스 예측 (Cross-Market)\n# 미국장 마이크론 → 한국장 하이닉스 시가 예측\n\nHynix_predicted = Hynix_close * (1 + β * MU_pctChange)\nβ: 선형 회귀 베타 (20일 롤링)\n시그널: MU ±1% 이상 → 하이닉스 상승/하락 예측\n\n데이터: Yahoo Finance\n저장: PostgreSQL + GitHub Dart_Data/prediction/`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 친구 추천 */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 text-center">
        <h3 className="text-sm font-bold flex items-center justify-center gap-2 mb-2"><Share2 className="w-4 h-4" /> 친구에게 추천하기</h3>
        <div className="bg-[var(--bg)] rounded-lg p-3 text-xs text-left font-mono whitespace-pre-wrap mb-2">{shareText}</div>
        <button onClick={handleCopy} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium">
          {copied ? "✅ 복사 완료!" : <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> 메시지 복사</span>}
        </button>
      </div>

      {/* CASSANDRA AI 링크 */}
      <div className="rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 p-4 text-center">
        <h3 className="text-lg font-bold text-[var(--accent-glow)]">CASSANDRA AI</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">DART 공시 기반 관계망 분석 · 인물 검색 · 이상 징후 탐지</p>
        <a href="/" className="inline-block mt-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium">로그인하고 분석 시작하기</a>
      </div>

      {/* 위험 고지 */}
      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2 text-[10px] text-[var(--text-muted)]">
        <p className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-[var(--warning)]" /> <strong className="text-[var(--warning)]">위험 고지</strong></p>
        <p>본 대시보드는 AI와 퀀트 모델을 활용한 시장 분석 도구입니다. 특정 종목의 매수·매도를 권유하지 않으며, 모든 투자 결정은 이용자 본인의 판단과 책임하에 이루어져야 합니다. 퀀트 지표는 과거 데이터 기반이므로 미래 수익을 보장하지 않습니다.</p>
      </div>

      <div className="text-center text-xs text-[var(--text-muted)] space-y-1">
        <a href="https://github.com/gameworkerkim/vibe-investing" target="_blank" className="text-[var(--accent-glow)] hover:underline flex items-center justify-center gap-1">
          <ExternalLink className="w-3 h-3" /> github.com/gameworkerkim/vibe-investing
        </a>
        <p>AI × 퀀트 × DART 공시 기반 코스닥 시장 분석 오픈소스</p>
      </div>
    </div>
  );
}
