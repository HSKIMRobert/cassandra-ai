"use client";

import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp, RefreshCw, DollarSign, ShieldAlert, Layers, BarChart2, Lock } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = ["gameworker@gmail.com"];
const KRW = (n: number) => `${(n / 1_000_000).toFixed(0)}백만`;
const PCT = (n: number | null, d = 1) => n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const USD = (n: number | null) => n == null ? "—" : `$${n.toFixed(2)}`;

function fmtDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}

const SIGNAL_STYLE: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  STRONG_BUY: { bg: "bg-[#22c55e]/10", border: "border-[#22c55e]/40", text: "text-[#22c55e]", icon: TrendingDown },
  BUY:        { bg: "bg-[#86efac]/10", border: "border-[#86efac]/30", text: "text-[#86efac]", icon: TrendingDown },
  WATCH:      { bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/30", text: "text-[#f59e0b]", icon: BarChart2 },
  HOLD:       { bg: "bg-[var(--surface)]", border: "border-[var(--border)]", text: "text-[var(--text-muted)]", icon: BarChart2 },
  REDUCE:     { bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/30", text: "text-[#ef4444]", icon: TrendingUp },
};

function MiniBar({ value, min, max, color }: { value: number; min: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function WilliamsGauge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--text-muted)]">—</span>;
  const pct = Math.max(0, Math.min(100, ((value + 100) / 100) * 100));
  const color = value <= -80 ? "text-[#22c55e]" : value >= -20 ? "text-[#ef4444]" : "text-[#f59e0b]";
  const label = value <= -80 ? "과매도" : value >= -20 ? "과매수" : "중립";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-[var(--text-muted)]">과매도(-100)</span>
        <span className={`font-mono font-bold ${color}`}>{value.toFixed(1)} <span className="text-[9px]">{label}</span></span>
        <span className="text-[var(--text-muted)]">과매수(0)</span>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden flex">
        <div className="w-[20%] bg-[#22c55e]/40" />
        <div className="w-[60%] bg-[#f59e0b]/20" />
        <div className="w-[20%] bg-[#ef4444]/40" />
      </div>
      <div className="relative h-0">
        <div className="absolute w-2 h-2 rounded-full bg-white border-2 border-[var(--border)] -top-1 -translate-x-1/2 shadow"
          style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

function DropMeter({ drop }: { drop: number }) {
  const abs = Math.abs(drop);
  const zones = [
    { label: "정상", from: 0, to: 3,  color: "bg-[var(--border)]" },
    { label: "1차", from: 3, to: 5,   color: "bg-[#86efac]/60" },
    { label: "2차", from: 5, to: 8,   color: "bg-[#22c55e]/70" },
    { label: "3차", from: 8, to: 12,  color: "bg-[#f59e0b]/80" },
    { label: "4차", from: 12, to: 20, color: "bg-[#f97316]/80" },
    { label: "5차", from: 20, to: 35, color: "bg-[#ef4444]/80" },
  ];
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1 h-8">
        {zones.map((z, i) => {
          const width = z.to - z.from;
          const active = abs >= z.from;
          const fillPct = active ? Math.min(1, (abs - z.from) / (z.to - z.from)) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
              <div className="relative h-6 bg-[var(--border)]/30 rounded-sm overflow-hidden">
                <div className={`absolute bottom-0 left-0 right-0 ${z.color} transition-all duration-700`}
                  style={{ height: `${fillPct}%` }} />
              </div>
              <span className="text-[8px] text-center text-[var(--text-muted)]">{z.label}</span>
            </div>
          );
        })}
      </div>
      <div className="text-center">
        <span className={`text-lg font-bold font-mono ${abs >= 12 ? "text-[#ef4444]" : abs >= 5 ? "text-[#f59e0b]" : abs >= 3 ? "text-[#22c55e]" : "text-[var(--text-muted)]"}`}>
          {drop.toFixed(2)}%
        </span>
        <span className="text-[10px] text-[var(--text-muted)] ml-1">QQQ 20일 고점 대비</span>
      </div>
    </div>
  );
}

function PortfolioDonut({ tqqqR, usdR, bondR }: { tqqqR: number; usdR: number; bondR: number }) {
  const total = 100_000_000;
  const segments = [
    { label: "TQQQ", ratio: tqqqR, color: "#3b82f6", krw: tqqqR * total },
    { label: "USD 예비", ratio: usdR, color: "#22c55e", krw: usdR * total },
    { label: "채권(TLT/IEF)", ratio: bondR, color: "#f59e0b", krw: bondR * total },
  ];
  let cum = 0;
  const r = 40, cx = 60, cy = 60, gap = 0.02;
  const paths = segments.map(seg => {
    const start = cum;
    cum += seg.ratio - gap;
    const s = (start * 2 * Math.PI) - Math.PI / 2;
    const e = ((start + seg.ratio - gap) * 2 * Math.PI) - Math.PI / 2;
    const laf = seg.ratio > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
    cum += gap;
    return { ...seg, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${laf} 1 ${x2} ${y2} Z` };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="w-24 h-24 shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={24} fill="var(--surface)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={8} fill="var(--text-muted)">1억</text>
        <text x={cx} y={cy + 7} textAnchor="middle" fontSize={8} fill="white" fontWeight="bold">KRW</text>
      </svg>
      <div className="space-y-1.5 flex-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] text-[var(--text-muted)] flex-1">{s.label}</span>
            <span className="text-[11px] font-mono font-bold">{KRW(s.krw)}원</span>
            <span className="text-[10px] text-[var(--text-muted)]">({(s.ratio * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuoteCard({ q, label }: { q: any; label: string }) {
  if (!q) return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 text-center text-[11px] text-[var(--text-muted)]">
      {label} 데이터 없음
    </div>
  );
  const up = q.change1d >= 0;
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold">{label}</span>
        <span className={`text-xs font-mono font-bold ${up ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
          {PCT(q.change1d)}
        </span>
      </div>
      <div className="text-xl font-mono font-bold">{USD(q.price)}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[var(--text-muted)]">
        <span>RSI14 <span className={`font-bold ${q.rsi14 < 30 ? "text-[#22c55e]" : q.rsi14 > 70 ? "text-[#ef4444]" : "text-white"}`}>{q.rsi14?.toFixed(0) ?? "—"}</span></span>
        <span>WR%R <span className={`font-bold ${q.williamsR <= -80 ? "text-[#22c55e]" : q.williamsR >= -20 ? "text-[#ef4444]" : "text-white"}`}>{q.williamsR?.toFixed(0) ?? "—"}</span></span>
        <span>20일↓ <span className={`font-bold ${Math.abs(q.drawdown20d) >= 5 ? "text-[#f59e0b]" : "text-white"}`}>{PCT(q.drawdown20d)}</span></span>
        <span>52주↓ <span className="font-bold text-white">{PCT(q.drawdown52w)}</span></span>
      </div>
      <WilliamsGauge value={q.williamsR} />
    </div>
  );
}

export default function TQQQPage() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [authed, setAuthed]   = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      loadData();
    })();
  }, []);

  async function loadData(force = false) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/tqqq${force ? "?refresh=1" : ""}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (authed === false) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center space-y-3">
          <Lock className="w-10 h-10 text-[var(--text-muted)] mx-auto" />
          <p className="text-[var(--text-muted)] text-sm">관리자 전용 페이지입니다.</p>
        </div>
      </main>
    );
  }

  if (authed === null || loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <p className="text-[var(--text-muted)] text-sm animate-pulse">로딩 중...</p>
      </main>
    );
  }

  const ss = data?.signal ? SIGNAL_STYLE[data.signal] : SIGNAL_STYLE.HOLD;
  const SigIcon = ss.icon;
  const drop = data?.dropFrom20dHigh ?? 0;
  const active = data?.activeTranches ?? [];
  const next = data?.nextTranche ?? null;
  const p = data?.portfolio;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">📈</span> TQQQ 딥바잉 전략
              <span className="text-[10px] bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] px-2 py-0.5 rounded-full">관리자 전용</span>
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              나스닥 하락 깊이별 분할매수 · 1억 기준 · USD+채권 예비자금 보유
              {data?.fetchedAt && <> · {fmtDate(data.fetchedAt)} 기준</>}
            </p>
          </div>
          <button
            onClick={() => { setRefreshing(true); loadData(true); }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            즉시 갱신
          </button>
        </div>

        {error && (
          <div className="rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/20 p-3 text-[11px] text-[#ef4444]">
            데이터 오류: {error}
          </div>
        )}

        {/* 시그널 배너 */}
        {data && (
          <div className={`rounded-xl border p-4 ${ss.bg} ${ss.border}`}>
            <div className="flex items-center gap-3 flex-wrap">
              <SigIcon className={`w-6 h-6 ${ss.text}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-base font-bold ${ss.text}`}>{data.signal}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{data.reason}</span>
                </div>
                {next && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    다음 트랜치: <span className="text-white">{next.label}</span> — QQQ -{next.minDrop}% 도달 시 ({KRW(next.alloc * 100_000_000)}원)
                  </p>
                )}
              </div>
              {active.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {active.map((t: any) => (
                    <span key={t.label} className="text-[10px] font-bold bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded-full">
                      {t.label} 활성
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QQQ 하락 미터 + 포트폴리오 */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
              <h2 className="text-xs font-bold flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> QQQ 하락 깊이 (진입 트리거)</h2>
              <DropMeter drop={drop} />
              <div className="grid grid-cols-5 gap-1">
                {(data.tranches ?? []).map((t: any) => {
                  const isActive = active.some((a: any) => a.label === t.label);
                  return (
                    <div key={t.label} className={`rounded-lg p-2 text-center border text-[9px] ${isActive ? "bg-[#22c55e]/10 border-[#22c55e]/40" : "bg-[var(--bg)] border-[var(--border)]"}`}>
                      <div className={`font-bold text-[11px] ${isActive ? "text-[#22c55e]" : "text-[var(--text-muted)]"}`}>{t.label}</div>
                      <div className="text-[var(--text-muted)]">-{t.minDrop}%</div>
                      <div className={`font-bold mt-0.5 ${isActive ? "text-white" : "text-[var(--text-muted)]"}`}>{(t.alloc * 100).toFixed(0)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
              <h2 className="text-xs font-bold flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> 포트폴리오 배분 (1억 기준)</h2>
              {p && <PortfolioDonut tqqqR={p.tqqqRatio} usdR={p.usdRatio} bondR={p.bondRatio} />}
              <div className="pt-1 border-t border-[var(--border)] space-y-1 text-[10px] text-[var(--text-muted)]">
                <p>· TQQQ: 최대 40% (4천만원) — 트랜치 누적 진입</p>
                <p>· USD 예비: 30% (3천만원) — 달러 현금 보유</p>
                <p>· 채권(TLT/IEF): 30% (3천만원) — 하락 헤지 + 금리수익</p>
              </div>
            </div>
          </div>
        )}

        {/* 종목 시세 */}
        {data && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" /> 주요 종목 시세</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <QuoteCard q={data.quotes.qqq}  label="QQQ (나스닥100 ETF)" />
              <QuoteCard q={data.quotes.tqqq} label="TQQQ (3x 레버리지)" />
              <QuoteCard q={data.quotes.tlt}  label="TLT (장기국채)" />
              <QuoteCard q={data.quotes.ief}  label="IEF (중기국채)" />
            </div>
          </div>
        )}

        {/* 트랜치 전략 상세 */}
        {data && (
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
            <h2 className="text-xs font-bold flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> 분할매수 트랜치 전략 (1억 기준)</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <th className="text-left pb-2 pr-3">트랜치</th>
                    <th className="text-left pb-2 pr-3">QQQ 하락 조건</th>
                    <th className="text-right pb-2 pr-3">비중</th>
                    <th className="text-right pb-2 pr-3">금액</th>
                    <th className="text-left pb-2">전략 메모</th>
                    <th className="text-center pb-2">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {(data.tranches ?? []).map((t: any) => {
                    const isActive = active.some((a: any) => a.label === t.label);
                    return (
                      <tr key={t.label} className={isActive ? "bg-[#22c55e]/5" : ""}>
                        <td className="py-2 pr-3 font-bold">{t.label}</td>
                        <td className="py-2 pr-3 text-[var(--text-muted)]">-{t.minDrop}% ~ -{t.maxDrop === 99 ? "∞" : t.maxDrop}%</td>
                        <td className="py-2 pr-3 text-right font-mono">{(t.alloc * 100).toFixed(0)}%</td>
                        <td className="py-2 pr-3 text-right font-mono">{KRW(t.alloc * 100_000_000)}원</td>
                        <td className="py-2 pr-3 text-[var(--text-muted)]">{t.note}</td>
                        <td className="py-2 text-center">
                          {isActive
                            ? <span className="text-[10px] font-bold text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/30 px-2 py-0.5 rounded-full">● 활성</span>
                            : <span className="text-[10px] text-[var(--text-muted)]">대기</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[var(--border)] font-bold">
                    <td className="pt-2 pr-3">합계</td>
                    <td className="pt-2 pr-3 text-[var(--text-muted)]">최대 -20% 이상</td>
                    <td className="pt-2 pr-3 text-right font-mono">40%</td>
                    <td className="pt-2 pr-3 text-right font-mono">4,000만원</td>
                    <td className="pt-2 pr-3 text-[var(--text-muted)]">TQQQ 최대 비중</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 전략 원칙 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-2">
          <h2 className="text-xs font-bold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-[#f59e0b]" /> 전략 원칙 & 리스크 관리</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[var(--text-muted)]">
            <div className="space-y-1.5">
              <p className="font-bold text-white text-xs">매수 규칙</p>
              <p>· QQQ 20일 고점 대비 하락 구간 확인 후 트랜치 진입</p>
              <p>· RSI &lt; 35 또는 Williams %R ≤ -80 과매도 신호 동반 시 가중</p>
              <p>· 트랜치당 1회만 진입 — 동일 구간 재매수 금지</p>
              <p>· 반등 +15% 이상 시 원금의 50% 익절 후 트랜치 리셋</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-bold text-white text-xs">예비자금 운용</p>
              <p>· USD 현금(30%): 단기 달러 예금 / MMF 유지</p>
              <p>· 채권(30%): TLT 20% + IEF 10% — 침체기 헤지</p>
              <p>· 금리형 하락(Rate Stress 高) 시 채권→단기채(BIL) 전환</p>
              <p>· TQQQ 최대 비중 40% 초과 불가 — 레버리지 리스크 제한</p>
            </div>
          </div>
          <div className="pt-2 border-t border-[var(--border)] text-[10px] text-[#ef4444]/70">
            ⚠️ TQQQ는 3배 레버리지 ETF로 변동성 감쇄(volatility decay) 리스크가 있습니다. 장기 하락 시 손실이 지수 하락의 3배를 초과할 수 있습니다.
            본 대시보드는 개인 투자 연구 도구이며 투자 권유가 아닙니다.
          </div>
        </div>

      </div>
    </main>
  );
}
