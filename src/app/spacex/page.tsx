"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Rocket, RefreshCw, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, Twitter, AlertTriangle, BookOpen,
} from "lucide-react";

const GROUP_LABEL: Record<string, string> = {
  pure_space: "🚀 Pure Space",
  etf: "📦 Space ETF",
  defense: "🛡 Defense / Aerospace",
};

const SIGNAL_STYLE: Record<string, string> = {
  BUY:   "bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30",
  HOLD:  "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30",
  AVOID: "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30",
  SELL:  "bg-[#ef4444]/15 text-[#ef4444] border border-[#ef4444]/30",
};

const SENTIMENT_STYLE: Record<string, string> = {
  bullish: "text-[#22c55e]",
  bearish: "text-[#ef4444]",
  neutral: "text-[#f59e0b]",
};
const SENTIMENT_LABEL: Record<string, string> = {
  bullish: "📈 강세",
  bearish: "📉 약세",
  neutral: "➡ 중립",
};
const RISK_STYLE: Record<string, string> = {
  high:   "bg-[#ef4444]/10 text-[#ef4444]",
  medium: "bg-[#f59e0b]/10 text-[#f59e0b]",
  low:    "bg-[#22c55e]/10 text-[#22c55e]",
};

function fmtPct(v: number | null, digits = 1) {
  if (v == null) return "-";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}
function fmtNum(v: number | null, digits = 2) {
  if (v == null) return "-";
  return `$${v.toFixed(digits)}`;
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return s; }
}

/* ──────────────────── Williams %R 게이지 ──────────────────── */
function WilliamsRBar({ value }: { value: number | null }) {
  if (value == null) return <div className="text-[10px] text-[var(--text-muted)]">-</div>;
  const pos   = Math.abs(value);
  const color = pos >= 80 ? "#22c55e" : pos <= 20 ? "#ef4444" : "#f59e0b";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
        <span>과매수</span>
        <span className="font-semibold" style={{ color }}>{value.toFixed(1)}</span>
        <span>과매도</span>
      </div>
      <div className="relative h-2 rounded-full bg-[var(--border)]">
        <div className="absolute inset-y-0 left-0 w-1/5 rounded-l-full bg-[#ef4444]/20" />
        <div className="absolute inset-y-0 right-0 w-1/5 rounded-r-full bg-[#22c55e]/20" />
        <div className="absolute top-0.5 w-2.5 h-1 rounded-full -translate-x-1/2"
          style={{ left: `${pos}%`, backgroundColor: color }} />
      </div>
      <div className="text-[9px] text-[var(--text-muted)] text-center">
        {pos >= 80 ? "😰 과매도 — 반등 기대" : pos <= 20 ? "🔥 과매수 — 조정 주의" : "😐 중립 구간"}
      </div>
    </div>
  );
}

/* ──────────────────── 점수 바 ──────────────────── */
function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return null;
  const pct   = ((score + 3) / 6) * 100;
  const color = score >= 1.5 ? "#22c55e" : score <= -1.5 ? "#ef4444" : "#f59e0b";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] text-[var(--text-muted)]">
        <span>-3 매도</span>
        <span className="font-bold text-xs" style={{ color }}>{score >= 0 ? "+" : ""}{score.toFixed(1)}</span>
        <span>매수 +3</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-[var(--border)]">
        <div className="absolute top-0 left-1/2 bottom-0 w-px bg-[var(--border)]" />
        <div className="absolute inset-y-0 rounded-full"
          style={{
            left: score < 0 ? `${pct}%` : "50%",
            right: score >= 0 ? `${100 - pct}%` : "50%",
            backgroundColor: color,
          }} />
      </div>
    </div>
  );
}

/* ──────────────────── 지표 박스 ──────────────────── */
function IndicatorBox({ label, value, unit, note }: { label: string; value: any; unit: string; note?: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-2.5">
      <div className="text-[9px] text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value != null ? `${unit}${value}` : "-"}</div>
      {note && <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{note}</div>}
    </div>
  );
}

/* ──────────────────── Williams %R 코멘트 ──────────────────── */
function wilRComment(wr: number | null, symbol: string) {
  if (wr == null) return "데이터 없음";
  const pos = Math.abs(wr);
  if (pos >= 80) return `${symbol}의 Williams %R(${wr.toFixed(1)})이 과매도 구간(-80 이하)에 진입했습니다. 단기 심리가 극도로 위축된 상태로, 역발상 매수 관점에서 관심을 가질 시점입니다.`;
  if (pos <= 20) return `${symbol}의 Williams %R(${wr.toFixed(1)})이 과매수 구간(-20 이상)에 위치합니다. 단기 투자심리가 과열된 상태로 신규 매수보다는 관망이 적절합니다.`;
  if (pos <= 60) return `${symbol}의 Williams %R(${wr.toFixed(1)})은 중립~약세 구간입니다. 매도 압력이 다소 우세하나 극단적 구간은 아닙니다.`;
  return `${symbol}의 Williams %R(${wr.toFixed(1)})은 중립 구간(-20~-80)입니다. 방향성이 불명확하며 다른 지표와 종합 판단이 필요합니다.`;
}

function signalComment(s: any) {
  const wr = s.williamsR?.toFixed(1), rsi = s.rsi14?.toFixed(1);
  if (s.signal === "BUY")   return `퀀트 점수 ${s.score >= 0 ? "+" : ""}${s.score?.toFixed(1)}: Williams %R ${wr}, RSI ${rsi}로 과매도 영역. 분할 매수 접근 권장.`;
  if (s.signal === "SELL")  return `퀀트 점수 ${s.score?.toFixed(1)}: 과매수+하락 모멘텀. 보유 중이라면 손절/익절 검토.`;
  if (s.signal === "AVOID") return `퀀트 점수 ${s.score?.toFixed(1)}: 약세 신호 우세. 저점 확인 전 관망 권장.`;
  return `퀀트 점수 ${s.score >= 0 ? "+" : ""}${s.score?.toFixed(1)}: 중립 신호. 소량 운용 또는 관망.`;
}

/* ──────────────────── 주식 카드 ──────────────────── */
function StockCard({ stock, expanded, onToggle }: { stock: any; expanded: boolean; onToggle: () => void }) {
  const chg1d = stock.change1d;
  const chgColor = chg1d == null ? "text-[var(--text-muted)]" : chg1d >= 0 ? "text-[#22c55e]" : "text-[#ef4444]";
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--border)]/20 transition-colors text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{stock.symbol}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${SIGNAL_STYLE[stock.signal] || SIGNAL_STYLE.HOLD}`}>{stock.signal}</span>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] truncate">{stock.name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-bold">{fmtNum(stock.price)}</div>
          <div className={`text-[10px] font-medium ${chgColor}`}>{fmtPct(stock.change1d)}</div>
        </div>
        <div className="shrink-0 w-24"><WilliamsRBar value={stock.williamsR} /></div>
        <div className="shrink-0 text-[var(--text-muted)]">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-4 space-y-4 bg-[var(--bg)]/40">
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-muted)] mb-1">종합 퀀트 점수</p>
            <ScoreBar score={stock.score} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <IndicatorBox label="Williams %R" value={stock.williamsR?.toFixed(1)} unit="" note={stock.williamsR <= -80 ? "과매도" : stock.williamsR >= -20 ? "과매수" : "중립"} />
            <IndicatorBox label="RSI 14" value={stock.rsi14?.toFixed(1)} unit="" note={stock.rsi14 < 30 ? "과매도" : stock.rsi14 > 70 ? "과매수" : "중립"} />
            <IndicatorBox label="SMA 20" value={stock.sma20?.toFixed(2)} unit="$" note={stock.price > stock.sma20 ? "📈 위 (강세)" : "📉 아래 (약세)"} />
            <IndicatorBox label="SMA 50" value={stock.sma50?.toFixed(2)} unit="$" note={stock.price > stock.sma50 ? "📈 위 (강세)" : "📉 아래 (약세)"} />
            <IndicatorBox label="20일 모멘텀" value={stock.momentum20?.toFixed(1)} unit="%" note={stock.momentum20 > 10 ? "강한 상승" : stock.momentum20 < -10 ? "강한 하락" : "보합"} />
            <IndicatorBox label="5일 변동" value={stock.change5d?.toFixed(1)} unit="%" />
            <IndicatorBox label="52W 고점" value={stock.high52w?.toFixed(2)} unit="$" note={stock.high52w ? `고점 대비 ${(((stock.price / stock.high52w) - 1) * 100).toFixed(1)}%` : ""} />
            <IndicatorBox label="52W 저점" value={stock.low52w?.toFixed(2)} unit="$" note={stock.low52w ? `저점 대비 +${(((stock.price / stock.low52w) - 1) * 100).toFixed(1)}%` : ""} />
          </div>
          <div className="rounded-lg bg-[var(--surface)] border border-[var(--border)] p-3">
            <p className="text-[10px] font-semibold mb-1">🧠 시장 심리 분석 (Williams %R)</p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{wilRComment(stock.williamsR, stock.symbol)}</p>
          </div>
          <div className={`rounded-lg p-3 text-[11px] leading-relaxed ${SIGNAL_STYLE[stock.signal] || ""}`}>
            <span className="font-semibold">[{stock.signal}] </span>{signalComment(stock)}
          </div>
          <p className="text-[9px] text-[var(--text-muted)]">⚠ 자동화 퀀트 모델 결과입니다. 실제 투자 결정 전 추가 검토 필요.</p>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── 일론 머스크 뉴스 ──────────────────── */
function ElonNewsSection() {
  const [tweets, setTweets]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [fetchedAt, setFetchedAt] = useState("");
  const [source, setSource]   = useState("");
  const [isXPost, setIsXPost] = useState(false);

  useEffect(() => {
    fetch("/api/spacex/news")
      .then(r => r.json())
      .then(d => {
        setTweets(d.tweets || []);
        setFetchedAt(d.fetchedAt || "");
        setSource(d.source || "");
        setIsXPost(d.isXPost || false);
        if (d.error) setError(d.error);
      })
      .catch(() => setError("뉴스 로딩 실패"))
      .finally(() => setLoading(false));
  }, []);

  const sectionTitle = isXPost
    ? "일론 머스크 X — SpaceX 관련 포스트 & LLM 분석"
    : "SpaceX 관련 최신 뉴스 & LLM 분석";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Twitter className="w-4 h-4 text-[#1d9bf0]" />
          {sectionTitle}
        </h2>
        <div className="flex items-center gap-2">
          {source && !isXPost && (
            <span className="text-[9px] text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded">
              📰 Google News
            </span>
          )}
          {fetchedAt && <span className="text-[9px] text-[var(--text-muted)]">{fmtDate(fetchedAt)} 기준</span>}
        </div>
      </div>

      {loading && <p className="text-[11px] text-[var(--text-muted)] py-4 text-center">뉴스 가져오는 중...</p>}
      {!loading && error && !tweets.length && (
        <div className="rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/20 p-3 text-[11px] text-[#ef4444]">
          뉴스를 가져올 수 없습니다: {error}
        </div>
      )}
      {!loading && !tweets.length && !error && (
        <p className="text-[11px] text-[var(--text-muted)] py-4 text-center">SpaceX 관련 뉴스가 없습니다.</p>
      )}

      <div className="space-y-3">
        {tweets.map((t, i) => {
          const a = t.analysis;
          return (
            <div key={i} className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
              {/* 본문 */}
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-[#1d9bf0]/20 flex items-center justify-center shrink-0">
                  <Twitter className="w-3.5 h-3.5 text-[#1d9bf0]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold">{isXPost ? "@elonmusk" : "SpaceX News"}</span>
                    <span className="text-[9px] text-[var(--text-muted)]">{fmtDate(t.pubDate)}</span>
                    {t.link && (
                      <a href={t.link} target="_blank" rel="noopener noreferrer"
                        className="text-[9px] text-[#1d9bf0] hover:underline ml-auto">원문 ↗</a>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text)] leading-relaxed">
                    {t.text.slice(0, 280)}{t.text.length > 280 ? "..." : ""}
                  </p>
                </div>
              </div>

              {/* LLM 분석 */}
              {a ? (
                <div className="border-t border-[var(--border)] pt-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold ${SENTIMENT_STYLE[a.sentiment] || ""}`}>
                      {SENTIMENT_LABEL[a.sentiment] || a.sentiment}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${RISK_STYLE[a.riskLevel] || ""}`}>
                      리스크 {a.riskLevel === "high" ? "높음" : a.riskLevel === "medium" ? "중간" : "낮음"}
                    </span>
                    {(a.tags || []).map((tag: string) => (
                      <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--border)] text-[var(--text-muted)]">#{tag}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="rounded-lg bg-[var(--bg)] border border-[var(--border)] p-2.5">
                      <p className="text-[9px] text-[var(--text-muted)] mb-1">📊 주가 영향</p>
                      <p className="text-[11px]">{a.impact}</p>
                    </div>
                    <div className="rounded-lg bg-[var(--bg)] border border-[var(--border)] p-2.5">
                      <p className="text-[9px] text-[var(--text-muted)] mb-1">💡 투자 방향</p>
                      <p className="text-[11px]">{a.investNote}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t border-[var(--border)] pt-2">
                  <p className="text-[10px] text-[var(--text-muted)]">분석 데이터 없음 (DEEPSEEK_API_KEY 확인)</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────── Quant Prompt 살펴보기 ──────────────────── */
const QUANT_MD = `# SpaceX 및 항공우주 섹터 퀀트 투자 분석

## 주요 수정사항 (2026.06)

**SPCX 밸류에이션 오류**: 고점 대비 -13%에서 **-27~31%**로 수정. ATH $225.64(6/16) 기준 과매도 상태.

**ASTS 데이터 역전**: 52주 고가 $80.66은 오류. 실제 고가는 **$133.86**(5/28), 현재가는 고점 대비 약 **-40% 하락**.

**xAI 관계 오해**: xAI는 2026년 2월 SpaceX가 인수, 자본 부채가 아닌 **사업부 통합**.

## 포트폴리오 추천

| 종목 | 액션 | 진입가 | 손절 | 목표 |
|------|------|--------|------|------|
| SpaceX | 관망 | $135–150 | $105 | $185–225 |
| Rocket Lab (RKLB) | 매수 | $90–100 | $80 | $130–150 |
| Intuitive Machines (LUNR) | 매수 | $20–23 | $16 | $35–40 |
| AST SpaceMobile (ASTS) | 투자유보 | — | — | — |

비중 배분: RKLB 25%, LUNR 20%, 현금 30%

## 핵심 모니터링 포인트

- **SPCX**: 내부자 락업 만료, $20B 채권 발행 영향
- **RKLB**: Neutron 로켓 첫 발사 (2026 Q4 목표)
- **LUNR**: $1.1B 수주잔고 전환율 (2026 목표 60–65%)

## Williams %R 해석 기준

- **-80 이하 (과매도)**: 역발상 매수 관점, 반등 가능성 주시
- **-20 이상 (과매수)**: 차익실현 또는 신규 매수 자제
- **-20 ~ -80 (중립)**: 추세 확인 후 판단

## 방법론 경고

> "LLM은 엑셀이지 오라클이 아니다."
> z-score 척도는 거짓 정밀성을 만들어냄 → 서수 척도(-3~+3)만 사용.
> 우주 섹터는 일일 8~15% 변동이 일반적이므로 실거래 전 라이브 데이터 재확인 필수.`;

function QuantPromptSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[var(--border)]/20 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          <BookOpen className="w-4 h-4 text-[#a855f7]" />
          퀀트 프롬프트 살펴보기
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
      </button>
      {open && (
        <div className="border-t border-[var(--border)] px-4 py-4">
          <pre className="text-[10px] text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap font-mono">
            {QUANT_MD}
          </pre>
          <a
            href="https://github.com/gameworkerkim/vibe-investing/blob/main/01.Trading%20Strategy/Awesome%20claude%20quant%20scripts/SpaceX/SpaceX_Quant.md"
            target="_blank" rel="noopener noreferrer"
            className="inline-block mt-3 text-[10px] text-[#a855f7] hover:underline"
          >
            GitHub에서 전문 보기 ↗
          </a>
        </div>
      )}
    </div>
  );
}

/* ──────────────────── 위험 고지 ──────────────────── */
function RiskDisclaimer() {
  return (
    <div className="rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-[#f59e0b] font-bold text-sm">
        <AlertTriangle className="w-4 h-4" />
        투자 위험 고지
      </div>
      <ul className="text-[10px] text-[var(--text-muted)] space-y-1 leading-relaxed list-disc list-inside">
        <li>본 페이지의 모든 분석은 자동화된 퀀트 모델과 LLM을 활용한 참고 자료이며, 투자 권유가 아닙니다.</li>
        <li>우주항공 섹터는 일일 8~15% 수준의 고변동성 자산으로, 원금 손실 위험이 큽니다.</li>
        <li>일론 머스크의 X 포스트는 자동 필터링 및 LLM 해석을 거치며, 오류·편향이 포함될 수 있습니다.</li>
        <li>Williams %R, RSI 등 기술적 지표는 과거 데이터 기반이며 미래 수익을 보장하지 않습니다.</li>
        <li>실제 투자 결정은 반드시 본인의 독립적 판단과 전문가 상담을 통해 이루어져야 합니다.</li>
        <li>데이터 출처: Yahoo Finance (가격), X/Nitter (SNS), DeepSeek (AI 분석). 실시간 데이터가 아닐 수 있습니다.</li>
      </ul>
    </div>
  );
}

/* ──────────────────── 섹터 카드 ──────────────────── */
function SectorCard({ label, value, note, color, icon }: any) {
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3">
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}<span className="text-[10px] text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {note && <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{note}</div>}
    </div>
  );
}

/* ──────────────────── 메인 페이지 ──────────────────── */
export default function SpaceXPage() {
  const [stocks, setStocks]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [expanded, setExpanded]   = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    force ? setRefreshing(true) : setLoading(true);
    try {
      const res  = await fetch(`/api/spacex${force ? "?refresh=1" : ""}`);
      const data = await res.json();
      setStocks(data.stocks || []);
      const dates = (data.stocks || []).map((s: any) => new Date(s.updatedAt).getTime());
      if (dates.length) setUpdatedAt(new Date(Math.max(...dates)));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = ["pure_space", "etf", "defense"];
  const sectorStats = {
    buyCount:  stocks.filter(s => s.signal === "BUY").length,
    sellCount: stocks.filter(s => ["SELL", "AVOID"].includes(s.signal)).length,
    avgWR:     stocks.length ? stocks.reduce((a, s) => a + (s.williamsR ?? -50), 0) / stocks.length : null,
    avgScore:  stocks.length ? stocks.reduce((a, s) => a + (s.score ?? 0), 0) / stocks.length : null,
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <Rocket className="w-8 h-8 mx-auto text-[var(--text-muted)] animate-bounce" />
        <p className="text-sm text-[var(--text-muted)]">퀀트 데이터 로딩 중...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Rocket className="w-6 h-6 text-[#3b82f6]" />
          <div>
            <h1 className="text-xl font-bold">SpaceX & Aerospace 퀀트</h1>
            <p className="text-[10px] text-[var(--text-muted)]">
              {updatedAt ? `마지막 갱신: ${updatedAt.toLocaleString("ko-KR")}` : "데이터 없음 — 즉시 갱신 버튼 클릭"}
              {" · "}미국장 마감 + 개장 30분 후 자동 갱신
            </p>
          </div>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs hover:border-[var(--accent)] disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "갱신 중..." : "즉시 갱신"}
        </button>
      </div>

      {/* 섹터 오버뷰 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SectorCard label="매수 신호" value={`${sectorStats.buyCount}종목`} color="#22c55e" icon={<TrendingUp className="w-4 h-4" />} />
        <SectorCard label="매도/회피" value={`${sectorStats.sellCount}종목`} color="#ef4444" icon={<TrendingDown className="w-4 h-4" />} />
        <SectorCard label="평균 Williams %R" value={sectorStats.avgWR?.toFixed(1) ?? "-"}
          note={sectorStats.avgWR != null ? (sectorStats.avgWR <= -70 ? "섹터 과매도" : sectorStats.avgWR >= -30 ? "섹터 과매수" : "섹터 중립") : ""}
          color="#f59e0b" icon={<Minus className="w-4 h-4" />} />
        <SectorCard label="평균 퀀트 점수"
          value={sectorStats.avgScore != null ? `${sectorStats.avgScore >= 0 ? "+" : ""}${sectorStats.avgScore.toFixed(2)}` : "-"}
          color={sectorStats.avgScore != null && sectorStats.avgScore >= 0.5 ? "#22c55e" : "#ef4444"}
          icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      {/* 주식 목록 */}
      {groups.map(group => {
        const gs = stocks.filter(s => s.group === group);
        if (!gs.length) return null;
        return (
          <div key={group} className="space-y-2">
            <h2 className="text-sm font-bold text-[var(--text-muted)]">{GROUP_LABEL[group]}</h2>
            <div className="space-y-2">
              {gs.map(stock => (
                <StockCard key={stock.symbol} stock={stock}
                  expanded={expanded === stock.symbol}
                  onToggle={() => setExpanded(expanded === stock.symbol ? null : stock.symbol)} />
              ))}
            </div>
          </div>
        );
      })}

      {stocks.length === 0 && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-sm">데이터가 없습니다. 즉시 갱신 버튼을 눌러주세요.</p>
        </div>
      )}

      {/* 일론 머스크 X 뉴스 */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
        <ElonNewsSection />
      </div>

      {/* 퀀트 프롬프트 살펴보기 */}
      <QuantPromptSection />

      {/* 위험 고지 */}
      <RiskDisclaimer />
    </div>
  );
}
