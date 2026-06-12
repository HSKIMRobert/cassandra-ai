"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Share2, Copy, Eye, ExternalLink, AlertTriangle, BarChart3, Activity, Clock, RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";

// ─── 더미 데이터 ───
const gaugeData = [
  { name: "공포", value: 35, color: "#ef4444" },
  { name: "중립", value: 40, color: "#f59e0b" },
  { name: "과열", value: 25, color: "#22c55e" },
];

const regimeData = [
  { date: "06/01", regime: 2 }, { date: "06/03", regime: 2 }, { date: "06/05", regime: 1 },
  { date: "06/07", regime: 2 }, { date: "06/09", regime: 2 }, { date: "06/11", regime: 3 },
];

// ARDS-X 개별 종목 평가
const regimeStocks = [
  { name: "에코프로비엠", score: 85, signal: "매수", color: "#22c55e" },
  { name: "알테오젠", score: 72, signal: "매수", color: "#22c55e" },
  { name: "에코프로", score: 65, signal: "관망", color: "#f59e0b" },
  { name: "레인보우로보틱스", score: 55, signal: "관망", color: "#f59e0b" },
  { name: "주성엔지니어링", score: 35, signal: "매도", color: "#ef4444" },
];

const momentumData = [
  { date: "06/01", amqs: 100, m7: 102 }, { date: "06/03", amqs: 103, m7: 105 },
  { date: "06/05", amqs: 107, m7: 110 }, { date: "06/07", amqs: 112, m7: 118 },
  { date: "06/09", amqs: 108, m7: 114 }, { date: "06/11", amqs: 115, m7: 122 },
];

// AMQS-M7 개별 종목
const amqsStocks = [
  { name: "엔비디아", score: 92, weight: "25%", signal: "매수" },
  { name: "TSMC", score: 88, weight: "20%", signal: "매수" },
  { name: "SK하이닉스", score: 82, weight: "18%", signal: "매수" },
  { name: "삼성전자", score: 75, weight: "15%", signal: "매수" },
  { name: "ASML", score: 70, weight: "12%", signal: "관망" },
  { name: "AMD", score: 62, weight: "10%", signal: "관망" },
];

// ARDS 헤지 종목
const ardsStocks = [
  { name: "AMQS-M7 Long", score: 65, signal: "매수", desc: "AI 반도체 모멘텀" },
  { name: "KOSDAQ150 인버스", score: 35, signal: "헤지", desc: "하락장 방어" },
  { name: "국고채 10년", score: 15, signal: "안전", desc: "무위험 자산" },
  { name: "금 현물", score: 10, signal: "안전", desc: "인플레이션 헤지" },
];

export default function QuantDashboard() {
  const [visitors, setVisitors] = useState({ today: 0, total: 0 });
  const [copied, setCopied] = useState(false);
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    fetch("/api/pageview").then(r => r.json()).then(d => {
      setVisitors({ today: d.today || 0, total: d.total || 0 });
    }).catch(() => {});
    setUpdatedAt(new Date().toLocaleString("ko-KR"));
  }, []);

  const shareText = `📊 CASSANDRA AI — 퀀트 대시보드\n\nAI×퀀트로 분석하는 코스닥 시장\nARS-X·AMQS·ARDS 전략\n\nhttps://dart-monitor-pi.vercel.app/quant`;
  const handleCopy = () => { navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Awesome LLM Quant Scripts Dashboard</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">AI × 퀀트 × DART 공시 기반 코스닥 시장 분석</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Clock className="w-3 h-3" /> 데이터 갱신
          </div>
          <div className="text-xs text-[var(--accent-glow)]">{updatedAt}</div>
          <button onClick={() => window.location.reload()} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] mt-1 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
          <div className="flex gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
            <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{visitors.today}</span>
            <span>누적 {visitors.total}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. 시장 게이지 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-[var(--warning)]" /> 시장 게이지</h2>
          <div className="flex items-center gap-0 h-8 rounded-full overflow-hidden">
            {gaugeData.map((g) => (
              <div key={g.name} className="h-full flex items-center justify-center text-[10px] font-bold text-white" style={{ width: `${g.value}%`, backgroundColor: g.color }}>
                {g.value > 20 ? g.name : ""}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-[var(--text-muted)]">
            <span>🔴 공포</span><span>🟡 중립</span><span>🟢 과열</span>
          </div>
          <p className="text-[10px] text-[var(--text-muted)] mt-3 leading-relaxed">
            <strong>시장 심리 지수</strong>는 Naver Finance의 거래량·등락률·검색어 데이터를 종합하여 산출합니다.
            공포 구간에서는 방어적 투자, 과열 구간에서는 차익 실현을 고려하세요.
            ※ Toss Securities API 활성화 시 실시간 데이터로 교체됩니다.
          </p>
        </div>

        {/* 2. ARDS-X Regime Classifier */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-[var(--accent-glow)]" /> 시장 국면 판단 (ARDS-X)</h2>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={regimeData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#888" }} />
              <YAxis domain={[0, 4]} tick={{ fontSize: 9, fill: "#888" }} />
              <Tooltip />
              <Line type="monotone" dataKey="regime" stroke="#6c5ce7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-[#ef4444]">0:하락</span><span className="text-[var(--text-muted)]">1:횡보</span><span className="text-[var(--accent-glow)]">2:상승</span><span className="text-[#22c55e]">3:급등</span>
          </div>

          {/* 개별 종목 평가 */}
          <div className="mt-3">
            <h4 className="text-[10px] font-semibold text-[var(--text-muted)] mb-1">📊 개별 종목 시그널</h4>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={regimeStocks} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={80} />
                <Tooltip />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {regimeStocks.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-[var(--text-muted)] mt-2 leading-relaxed">
            <strong>ARDS-X</strong>는 변동성·거래량·모멘텀을 결합하여 시장 국면을 4단계(하락/횡보/상승/급등)로 분류합니다.
            상승 국면에서는 공격적 비중, 하락 국면에서는 현금 비중을 늘리는 전략을 제안합니다.
          </p>
        </div>

        {/* 3. AMQS / AMQS-M7 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-[#22c55e]" /> AI 반도체 모멘텀 (AMQS / AMQS-M7)</h2>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={momentumData}>
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#888" }} />
              <YAxis domain={[95, 130]} tick={{ fontSize: 9, fill: "#888" }} />
              <Tooltip />
              <Line type="monotone" dataKey="amqs" stroke="#6c5ce7" strokeWidth={2} dot={false} name="AMQS" />
              <Line type="monotone" dataKey="m7" stroke="#22c55e" strokeWidth={2} dot={false} name="M7" />
            </LineChart>
          </ResponsiveContainer>

          {/* AMQS-M7 종목 테이블 */}
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
            모멘텀이 상승할 때 비중을 확대하고, 하락할 때 축소합니다.
          </p>
        </div>

        {/* 4. ARDS 헤지 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3"><TrendingDown className="w-4 h-4 text-[#ef4444]" /> 방어·헤지 (ARDS)</h2>

          {/* ARDS 구성 */}
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

          {/* 비중 */}
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
            시장 하락 국면에서 KOSDAQ150 인버스와 국고채로 포트폴리오를 방어합니다.
            비중은 Median + 15% Cap으로 관리되어 과도한 레버리지를 방지합니다.
          </p>
        </div>
      </div>

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
