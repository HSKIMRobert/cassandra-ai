"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingDown, TrendingUp, RefreshCw, DollarSign,
  ShieldAlert, Layers, BarChart2, Lock, Plus, Trash2,
  Bell, CheckCircle, AlertTriangle, Activity,
} from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

/* ── 포맷 helpers ── */
const KRW  = (n: number) => `${(n / 10_000).toFixed(0)}만원`;
const PCT  = (n: number | null, d = 1) => n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const USD  = (n: number | null) => n == null ? "—" : `$${n.toFixed(2)}`;
const NUM  = (n: number, d = 2) => n.toFixed(d);
const fmtDate = (s: string) => {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getMonth()+1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};
const today = () => new Date().toISOString().slice(0, 10);

/* ── DCA 백테스트 계산 ── */
function calcDCA(monthlyKrw: number, years: number, cagr: number): number {
  // 월복리 DCA: FV = PMT * [((1+r)^n - 1) / r]
  const r = cagr / 100 / 12;
  const n = years * 12;
  if (r === 0) return monthlyKrw * n;
  return monthlyKrw * ((Math.pow(1 + r, n) - 1) / r);
}

const DCA_SCENARIOS = [
  { label: "보수적", cagr: 8,  color: "#64748b", desc: "QQQ 위주 장기 보유" },
  { label: "기본",   cagr: 15, color: "#3b82f6", desc: "QQQ+TQQQ 혼합 DCA" },
  { label: "공격적", cagr: 22, color: "#22c55e", desc: "TQQQ 딥바잉 집중" },
];
const DCA_AMOUNTS  = [100, 200, 300, 500]; // 만원
const DCA_YEARS    = [5, 10, 15, 20];

/* ── 시그널 스타일 ── */
const SIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  STRONG_BUY: { bg:"bg-[#22c55e]/10", border:"border-[#22c55e]/40", text:"text-[#22c55e]", label:"강력 매수" },
  BUY:        { bg:"bg-[#86efac]/10", border:"border-[#86efac]/30", text:"text-[#86efac]", label:"매수" },
  WATCH:      { bg:"bg-[#f59e0b]/10", border:"border-[#f59e0b]/30", text:"text-[#f59e0b]", label:"관망" },
  HOLD:       { bg:"bg-[var(--surface)]", border:"border-[var(--border)]", text:"text-[var(--text-muted)]", label:"보유" },
  REDUCE:     { bg:"bg-[#ef4444]/10", border:"border-[#ef4444]/30", text:"text-[#ef4444]", label:"비중 축소" },
};

const SYMBOLS_DISPLAY: Record<string, string> = {
  QQQ:"QQQ (나스닥100)", TQQQ:"TQQQ (3x 레버리지)", TLT:"TLT (장기국채)", IEF:"IEF (중기국채)",
};

/* ── Williams Gauge ── */
function WilliamsGauge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[var(--text-muted)] text-[11px]">—</span>;
  const pct = Math.max(0, Math.min(100, ((value + 100) / 100) * 100));
  const color = value <= -80 ? "text-[#22c55e]" : value >= -20 ? "text-[#ef4444]" : "text-[#f59e0b]";
  const label = value <= -80 ? "과매도" : value >= -20 ? "과매수" : "중립";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px]">
        <span className="text-[var(--text-muted)]">-100 과매도</span>
        <span className={`font-mono font-bold ${color}`}>{value.toFixed(1)} <span className="opacity-70">{label}</span></span>
        <span className="text-[var(--text-muted)]">과매수 0</span>
      </div>
      <div className="relative h-1.5 w-full rounded-full overflow-hidden flex">
        <div className="w-[20%] bg-[#22c55e]/50" />
        <div className="w-[60%] bg-[#f59e0b]/20" />
        <div className="w-[20%] bg-[#ef4444]/50" />
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `calc(${pct}% - 1px)` }} />
      </div>
    </div>
  );
}

/* ── Quote Card ── */
function QuoteCard({ q, label }: { q: any; label: string }) {
  if (!q) return <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 text-center text-[11px] text-[var(--text-muted)]">{label} 로딩 중…</div>;
  const up = (q.change1d ?? 0) >= 0;
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold">{label}</span>
        <span className={`text-[11px] font-mono font-bold ${up ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{PCT(q.change1d)}</span>
      </div>
      <div className="text-lg font-mono font-bold">{USD(q.price)}</div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] text-[var(--text-muted)]">
        <span>RSI <span className={`font-bold ${q.rsi14 < 30 ? "text-[#22c55e]" : q.rsi14 > 70 ? "text-[#ef4444]" : "text-white"}`}>{q.rsi14?.toFixed(0) ?? "—"}</span></span>
        <span>W%R <span className={`font-bold ${q.williamsR <= -80 ? "text-[#22c55e]" : q.williamsR >= -20 ? "text-[#ef4444]" : "text-white"}`}>{q.williamsR?.toFixed(0) ?? "—"}</span></span>
        <span>20d↓ <span className={`font-bold ${Math.abs(q.drawdown20d) >= 5 ? "text-[#f59e0b]" : "text-white"}`}>{PCT(q.drawdown20d)}</span></span>
        <span>SMA50 <span className="font-bold text-white">{q.sma50 ? `$${q.sma50.toFixed(0)}` : "—"}</span></span>
      </div>
      <WilliamsGauge value={q.williamsR} />
    </div>
  );
}

/* ── Drop Meter ── */
const TRANCHE_ZONES = [
  { label:"정상", min:0,  max:3,  color:"bg-[var(--border)]" },
  { label:"1차",  min:3,  max:5,  color:"bg-[#86efac]/70" },
  { label:"2차",  min:5,  max:8,  color:"bg-[#22c55e]/70" },
  { label:"3차",  min:8,  max:12, color:"bg-[#f59e0b]/80" },
  { label:"4차",  min:12, max:20, color:"bg-[#f97316]/80" },
  { label:"5차",  min:20, max:35, color:"bg-[#ef4444]/80" },
];
function DropMeter({ drop }: { drop: number }) {
  const abs = Math.abs(drop);
  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1 h-10">
        {TRANCHE_ZONES.map((z, i) => {
          const fill = abs >= z.min ? Math.min(1, (abs - z.min) / (z.max - z.min)) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
              <div className="relative h-8 bg-[var(--border)]/30 rounded-sm overflow-hidden">
                <div className={`absolute bottom-0 left-0 right-0 ${z.color} transition-all`} style={{ height:`${fill}%` }} />
              </div>
              <span className="text-[8px] text-center text-[var(--text-muted)]">{z.label}</span>
            </div>
          );
        })}
      </div>
      <div className="text-center">
        <span className={`text-xl font-bold font-mono ${abs>=12?"text-[#ef4444]":abs>=5?"text-[#f59e0b]":abs>=3?"text-[#22c55e]":"text-[var(--text-muted)]"}`}>
          {drop >= 0 ? "+" : ""}{drop.toFixed(2)}%
        </span>
        <span className="text-[10px] text-[var(--text-muted)] ml-1">QQQ 20일 고점 대비</span>
      </div>
    </div>
  );
}

/* ── 일일 Action 카드 ── */
function DailyAction({ data, logs }: { data: any; logs: any[] }) {
  if (!data) return null;
  const drop = Math.abs(data.dropFrom20dHigh ?? 0);
  const sig  = data.signal ?? "HOLD";
  const ss   = SIG[sig] ?? SIG.HOLD;

  // 월간 DCA 추천 — 이번달 매수 여부 체크
  const thisMonth = today().slice(0, 7);
  const thisMonthLogs = logs.filter(l => l.date?.startsWith(thisMonth));
  const dcaDone = thisMonthLogs.length > 0;

  // 리밸런싱 필요 여부 — TQQQ 비중이 35% 이상이고 하락이 없으면
  const tqqqLogs  = logs.filter(l => l.symbol === "TQQQ");
  const totalKrw  = logs.reduce((s, l) => s + (l.krwAmount || 0), 0);
  const tqqqKrw   = tqqqLogs.reduce((s, l) => s + (l.krwAmount || 0), 0);
  const tqqqRatio = totalKrw > 0 ? tqqqKrw / totalKrw : 0;
  const needRebal = tqqqRatio > 0.42 && drop < 3;

  // QQQ가 크게 오른 날 — 수익 실현 체크
  const qqqUp = (data.quotes?.qqq?.change1d ?? 0) > 2;

  let action = "HOLD";
  let actionLabel = "보유 유지";
  let actionDesc  = "오늘은 추가 매수 또는 리밸런싱이 불필요합니다.";
  let actionColor = "text-[var(--text-muted)]";
  let actionBorder = "border-[var(--border)]";
  let actionBg    = "bg-[var(--surface)]";
  let ActionIcon: any = CheckCircle;

  if (needRebal) {
    action = "REBALANCE"; actionLabel = "리밸런싱 권장";
    actionDesc  = `TQQQ 비중이 ${(tqqqRatio*100).toFixed(0)}%로 목표(40%) 초과. QQQ·채권으로 일부 이동 고려.`;
    actionColor = "text-[#f59e0b]"; actionBorder = "border-[#f59e0b]/40"; actionBg = "bg-[#f59e0b]/5";
    ActionIcon = AlertTriangle;
  } else if (sig === "STRONG_BUY" || sig === "BUY") {
    action = "BUY"; actionLabel = "매수 타이밍";
    actionDesc  = data.reason ?? "";
    actionColor = "text-[#22c55e]"; actionBorder = "border-[#22c55e]/40"; actionBg = "bg-[#22c55e]/5";
    ActionIcon = TrendingDown;
  } else if (!dcaDone && new Date().getDate() >= 15) {
    action = "DCA"; actionLabel = "월 정기 매수";
    actionDesc  = "이번달 DCA 미실행 — QQQ·TQQQ·채권 정기 매수 실행하세요.";
    actionColor = "text-[#3b82f6]"; actionBorder = "border-[#3b82f6]/40"; actionBg = "bg-[#3b82f6]/5";
    ActionIcon = Bell;
  } else if (qqqUp) {
    action = "WATCH"; actionLabel = "급등 주의";
    actionDesc  = `오늘 QQQ ${PCT(data.quotes?.qqq?.change1d)} 급등. 신규 진입 자제, 다음 조정 대기.`;
    actionColor = "text-[#f97316]"; actionBorder = "border-[#f97316]/40"; actionBg = "bg-[#f97316]/5";
    ActionIcon = Activity;
  }

  // 이번달 추천 배분 (하락 깊이에 따라)
  const monthBudget = drop >= 8 ? 500 : drop >= 5 ? 300 : drop >= 3 ? 200 : 150;
  const tqqqPct = drop >= 8 ? 60 : drop >= 5 ? 50 : drop >= 3 ? 40 : 30;
  const qqqPct  = drop >= 8 ? 20 : drop >= 5 ? 25 : drop >= 3 ? 30 : 40;
  const bondPct = 100 - tqqqPct - qqqPct;

  return (
    <div className={`rounded-xl border ${actionBg} ${actionBorder} p-4 space-y-3`}>
      <div className="flex items-center gap-3">
        <ActionIcon className={`w-6 h-6 ${actionColor} shrink-0`} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-base font-bold ${actionColor}`}>{actionLabel}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${actionBorder} ${actionColor}`}>{action}</span>
            <span className="text-[10px] text-[var(--text-muted)] ml-auto">{fmtDate(new Date().toISOString())} 기준</span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{actionDesc}</p>
        </div>
      </div>

      {/* 이번달 DCA 추천 배분 */}
      <div className="border-t border-[var(--border)] pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-[var(--text-muted)]">이번달 추천 배분</span>
          <span className="text-[10px] text-[var(--text-muted)]">권장 투자금 <span className="text-white font-bold">{monthBudget}만원</span>
            {drop >= 3 && <span className="text-[#22c55e] ml-1">(하락 {drop.toFixed(1)}% — 비중 ↑)</span>}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { sym: "TQQQ", pct: tqqqPct, color: "#3b82f6" },
            { sym: "QQQ",  pct: qqqPct,  color: "#8b5cf6" },
            { sym: "채권",  pct: bondPct, color: "#f59e0b" },
          ].map(s => (
            <div key={s.sym} className="flex items-center gap-1.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="text-[11px] font-bold">{s.sym}</span>
              <span className="text-[11px] font-mono" style={{ color: s.color }}>{s.pct}%</span>
              <span className="text-[10px] text-[var(--text-muted)]">({Math.round(monthBudget * s.pct / 100)}만원)</span>
            </div>
          ))}
        </div>
        {dcaDone && (
          <div className="flex items-center gap-1 text-[10px] text-[#22c55e]">
            <CheckCircle className="w-3 h-3" /> 이번달 매수 기록 있음 ({thisMonthLogs.length}건)
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 매수 기록 입력 폼 ── */
function LogForm({ onAdd }: { onAdd: () => void }) {
  const [form, setForm] = useState({
    date: today(), symbol: "TQQQ", shares: "", priceUsd: "", krwAmount: "", usdKrw: "1380", note: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // 원화 자동 계산
  const calcKrw = () => {
    const s = parseFloat(form.shares), p = parseFloat(form.priceUsd), r = parseFloat(form.usdKrw);
    if (s && p && r) set("krwAmount", String(Math.round(s * p * r)));
  };

  const submit = async () => {
    if (!form.shares || !form.priceUsd) { setErr("주수와 단가는 필수입니다"); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch("/api/tqqq/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date, symbol: form.symbol,
          shares: parseFloat(form.shares), priceUsd: parseFloat(form.priceUsd),
          krwAmount: form.krwAmount ? parseFloat(form.krwAmount) : null,
          usdKrw: form.usdKrw ? parseFloat(form.usdKrw) : null,
          note: form.note || null,
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setForm({ date: today(), symbol: "TQQQ", shares: "", priceUsd: "", krwAmount: "", usdKrw: "1380", note: "" });
      onAdd();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
      <h3 className="text-xs font-bold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5 text-[#22c55e]" /> 매수 기록 추가</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="space-y-1">
          <label className="text-[9px] text-[var(--text-muted)]">날짜</label>
          <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-[var(--text-muted)]">종목</label>
          <select value={form.symbol} onChange={e => set("symbol", e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[var(--accent)]">
            {["TQQQ","QQQ","TLT","IEF"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-[var(--text-muted)]">주수</label>
          <input type="number" placeholder="0.00" value={form.shares} onChange={e => set("shares", e.target.value)} onBlur={calcKrw}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-[var(--text-muted)]">단가 (USD)</label>
          <input type="number" placeholder="$0.00" value={form.priceUsd} onChange={e => set("priceUsd", e.target.value)} onBlur={calcKrw}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-[var(--text-muted)]">환율 (KRW)</label>
          <input type="number" placeholder="1380" value={form.usdKrw} onChange={e => set("usdKrw", e.target.value)} onBlur={calcKrw}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-[var(--text-muted)]">금액 (원)</label>
          <input type="number" placeholder="자동계산" value={form.krwAmount} onChange={e => set("krwAmount", e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[var(--accent)]" />
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <input type="text" placeholder="메모 (선택)" value={form.note} onChange={e => set("note", e.target.value)}
          className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[11px] focus:outline-none focus:border-[var(--accent)]" />
        <button onClick={submit} disabled={saving}
          className="px-4 py-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold text-[11px] rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
          {saving ? "저장 중…" : "기록 추가"}
        </button>
      </div>
      {err && <p className="text-[10px] text-[#ef4444]">{err}</p>}
    </div>
  );
}

/* ── 평단 요약 ── */
function HoldingsSummary({ logs, quotes }: { logs: any[]; quotes: any }) {
  const symbols = ["TQQQ", "QQQ", "TLT", "IEF"];
  const holdings = symbols.map(sym => {
    const rows = logs.filter(l => l.symbol === sym);
    if (!rows.length) return null;
    const totalShares = rows.reduce((s, l) => s + l.shares, 0);
    const totalKrw    = rows.reduce((s, l) => s + (l.krwAmount || 0), 0);
    const avgPriceUsd = rows.reduce((s, l) => s + l.priceUsd * l.shares, 0) / totalShares;
    const curPrice    = quotes?.[sym.toLowerCase()]?.price ?? quotes?.qqq?.price ?? null;
    const pnlPct      = curPrice ? ((curPrice - avgPriceUsd) / avgPriceUsd) * 100 : null;
    const curKrw      = curPrice ? totalShares * curPrice * (logs.filter(l=>l.symbol===sym).at(-1)?.usdKrw ?? 1380) : null;
    return { sym, totalShares, avgPriceUsd, totalKrw, curPrice, pnlPct, curKrw };
  }).filter(Boolean) as any[];

  if (!holdings.length) return (
    <div className="text-center py-6 text-[11px] text-[var(--text-muted)]">아직 매수 기록이 없습니다. 위 폼에서 기록을 추가하세요.</div>
  );

  const totalCost = holdings.reduce((s, h) => s + h.totalKrw, 0);
  const totalCur  = holdings.reduce((s, h) => s + (h.curKrw ?? h.totalKrw), 0);
  const totalPnl  = totalCost > 0 ? ((totalCur - totalCost) / totalCost) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 text-center">
          <p className="text-[9px] text-[var(--text-muted)]">총 투자금</p>
          <p className="text-base font-bold font-mono">{KRW(totalCost)}</p>
        </div>
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 text-center">
          <p className="text-[9px] text-[var(--text-muted)]">평가금액</p>
          <p className="text-base font-bold font-mono">{KRW(totalCur)}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${totalPnl >= 0 ? "bg-[#22c55e]/5 border-[#22c55e]/30" : "bg-[#ef4444]/5 border-[#ef4444]/30"}`}>
          <p className="text-[9px] text-[var(--text-muted)]">수익률</p>
          <p className={`text-base font-bold font-mono ${totalPnl >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>{PCT(totalPnl)}</p>
        </div>
      </div>
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <table className="w-full text-[11px]">
          <thead className="border-b border-[var(--border)]">
            <tr className="text-[var(--text-muted)]">
              <th className="text-left px-3 py-2">종목</th>
              <th className="text-right px-3 py-2">주수</th>
              <th className="text-right px-3 py-2">평균단가</th>
              <th className="text-right px-3 py-2">현재가</th>
              <th className="text-right px-3 py-2">수익률</th>
              <th className="text-right px-3 py-2">투자금</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {holdings.map(h => (
              <tr key={h.sym}>
                <td className="px-3 py-2 font-bold">{h.sym}</td>
                <td className="px-3 py-2 text-right font-mono">{NUM(h.totalShares, 4)}</td>
                <td className="px-3 py-2 text-right font-mono">{USD(h.avgPriceUsd)}</td>
                <td className="px-3 py-2 text-right font-mono">{h.curPrice ? USD(h.curPrice) : "—"}</td>
                <td className={`px-3 py-2 text-right font-mono font-bold ${h.pnlPct == null ? "" : h.pnlPct >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                  {PCT(h.pnlPct)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[var(--text-muted)]">{KRW(h.totalKrw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── 매수 기록 테이블 ── */
function LogTable({ logs, onDelete }: { logs: any[]; onDelete: (id: string) => void }) {
  if (!logs.length) return null;
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-muted)]">매수 기록 ({logs.length}건)</div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-[11px]">
          <thead className="border-b border-[var(--border)] sticky top-0 bg-[var(--surface)]">
            <tr className="text-[var(--text-muted)]">
              <th className="text-left px-3 py-1.5">날짜</th>
              <th className="text-left px-3 py-1.5">종목</th>
              <th className="text-right px-3 py-1.5">주수</th>
              <th className="text-right px-3 py-1.5">단가(USD)</th>
              <th className="text-right px-3 py-1.5">금액(원)</th>
              <th className="text-left px-3 py-1.5">메모</th>
              <th className="px-3 py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-[var(--bg)]">
                <td className="px-3 py-1.5 font-mono text-[var(--text-muted)]">{l.date}</td>
                <td className="px-3 py-1.5 font-bold">{l.symbol}</td>
                <td className="px-3 py-1.5 text-right font-mono">{NUM(l.shares, 4)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{USD(l.priceUsd)}</td>
                <td className="px-3 py-1.5 text-right font-mono">{l.krwAmount ? KRW(l.krwAmount) : "—"}</td>
                <td className="px-3 py-1.5 text-[var(--text-muted)] text-[10px]">{l.note ?? ""}</td>
                <td className="px-3 py-1.5 text-center">
                  <button onClick={() => onDelete(l.id)} className="text-[var(--text-muted)] hover:text-[#ef4444] transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── DCA 백테스트 테이블 ── */
function BacktestTable() {
  const [scenario, setScenario] = useState(1); // 기본
  const sc = DCA_SCENARIOS[scenario];
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-bold flex items-center gap-1.5"><BarChart2 className="w-3.5 h-3.5" /> DCA 장기 시뮬레이션 (월 정기 투자)</h3>
        <div className="flex gap-1">
          {DCA_SCENARIOS.map((s, i) => (
            <button key={i} onClick={() => setScenario(i)}
              className={`px-2 py-1 rounded text-[10px] border transition-colors ${i === scenario ? "font-bold" : "text-[var(--text-muted)]"}`}
              style={{ borderColor: i === scenario ? s.color : "var(--border)", color: i === scenario ? s.color : undefined, background: i === scenario ? `${s.color}15` : undefined }}>
              {s.label} ({s.cagr}%)
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[var(--text-muted)]">{sc.desc} · 연 {sc.cagr}% CAGR 가정 · 세금/수수료 미반영</p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="border-b border-[var(--border)]">
            <tr className="text-[var(--text-muted)]">
              <th className="text-left pb-2 pr-4">월 투자금</th>
              {DCA_YEARS.map(y => <th key={y} className="text-right pb-2 px-2">{y}년</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {DCA_AMOUNTS.map(amt => {
              const total = amt * 10_000; // 만원 → 원
              return (
                <tr key={amt}>
                  <td className="py-2 pr-4 font-bold">{amt}만원/월</td>
                  {DCA_YEARS.map(y => {
                    const fv = calcDCA(total, y, sc.cagr);
                    const invested = total * y * 12;
                    const gain = fv - invested;
                    return (
                      <td key={y} className="py-2 px-2 text-right">
                        <div className="font-mono font-bold" style={{ color: sc.color }}>{KRW(fv)}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">+{KRW(gain)}</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
        {DCA_SCENARIOS.map((s, i) => (
          <div key={i} className="text-[10px] space-y-0.5">
            <div className="font-bold" style={{ color: s.color }}>{s.label} ({s.cagr}%)</div>
            <div className="text-[var(--text-muted)]">{s.desc}</div>
            <div className="text-[var(--text-muted)]">200만/월 × 10년 → <span className="text-white font-bold">{KRW(calcDCA(2_000_000, 10, s.cagr))}</span></div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-[var(--text-muted)]">
        ※ QQQ 역사적 CAGR: ~18% (2010-2026) · TQQQ 딥바잉 시 CAGR 20-25% 추정 · 채권 혼합 시 8-12%
        · 레버리지 변동성 감쇄(volatility decay) 미반영 — 실제 수익은 낮을 수 있음. 투자 권유 아님.
      </p>
    </div>
  );
}

/* ── 메인 페이지 ── */
export default function TQQQPage() {
  const [authed,     setAuthed]     = useState<boolean | null>(null);
  const [mktData,    setMktData]    = useState<any>(null);
  const [logs,       setLogs]       = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
        setAuthed(false); return;
      }
      setAuthed(true);
      await Promise.all([loadMarket(), loadLogs()]);
      setLoading(false);
    })();
  }, []);

  const loadMarket = useCallback(async (force = false) => {
    try {
      const res = await fetch(`/api/tqqq${force ? "?refresh=1" : ""}`);
      const d   = await res.json();
      if (!d.error) setMktData(d);
    } catch {}
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/tqqq/log");
      const d   = await res.json();
      setLogs(d.logs ?? []);
    } catch {}
  }, []);

  const deleteLog = async (id: string) => {
    await fetch("/api/tqqq/log", { method: "DELETE", headers: { "Content-Type":"application/json" }, body: JSON.stringify({ id }) });
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  if (authed === false) return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="text-center space-y-3"><Lock className="w-10 h-10 text-[var(--text-muted)] mx-auto" /><p className="text-[var(--text-muted)] text-sm">관리자 전용 페이지입니다.</p></div>
    </main>
  );
  if (authed === null || loading) return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <p className="text-[var(--text-muted)] text-sm animate-pulse">로딩 중…</p>
    </main>
  );

  const quotes: Record<string, any> = {
    qqq: mktData?.quotes?.qqq, tqqq: mktData?.quotes?.tqqq,
    tlt: mktData?.quotes?.tlt, ief: mktData?.quotes?.ief,
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">📈</span> TQQQ 장기 DCA 전략
              <span className="text-[10px] bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] px-2 py-0.5 rounded-full">관리자 전용</span>
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              월 100~500만원 · QQQ·TQQQ·미국채 장기 보유 · 나스닥 하락 시 TQQQ 비중 확대
              {mktData?.fetchedAt && <> · {fmtDate(mktData.fetchedAt)} 기준</>}
            </p>
          </div>
          <button onClick={() => { setRefreshing(true); loadMarket(true).then(() => setRefreshing(false)); }} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-xs transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> 즉시 갱신
          </button>
        </div>

        {/* 오늘의 액션 */}
        <DailyAction data={mktData} logs={logs} />

        {/* 시세 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <QuoteCard q={quotes.qqq}  label="QQQ" />
          <QuoteCard q={quotes.tqqq} label="TQQQ" />
          <QuoteCard q={quotes.tlt}  label="TLT" />
          <QuoteCard q={quotes.ief}  label="IEF" />
        </div>

        {/* QQQ 하락 미터 + 트랜치 */}
        {mktData && (
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
            <h2 className="text-xs font-bold flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> QQQ 하락 깊이 — 딥바잉 트리거</h2>
            <DropMeter drop={mktData.dropFrom20dHigh ?? 0} />
            <div className="grid grid-cols-5 gap-1.5">
              {(mktData.tranches ?? []).map((t: any) => {
                const isActive = (mktData.activeTranches ?? []).some((a: any) => a.label === t.label);
                return (
                  <div key={t.label} className={`rounded-lg p-2 text-center border text-[9px] transition-colors ${isActive ? "bg-[#22c55e]/10 border-[#22c55e]/40" : "bg-[var(--bg)] border-[var(--border)]"}`}>
                    <div className={`font-bold text-[11px] ${isActive ? "text-[#22c55e]" : "text-[var(--text-muted)]"}`}>{t.label}</div>
                    <div className="text-[var(--text-muted)]">-{t.minDrop}%</div>
                    <div className={`font-bold mt-0.5 ${isActive ? "text-white" : "text-[var(--text-muted)]"}`}>{(t.alloc*100).toFixed(0)}%</div>
                    <div className={`text-[8px] mt-0.5 ${isActive ? "text-[#22c55e]" : "text-[var(--text-muted)]"}`}>{isActive ? "● 활성" : "대기"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 평단 요약 */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> 보유 현황 & 평균 매수단가</h2>
          <HoldingsSummary logs={logs} quotes={quotes} />
        </div>

        {/* 매수 기록 입력 */}
        <LogForm onAdd={loadLogs} />

        {/* 매수 기록 테이블 */}
        <LogTable logs={logs} onDelete={deleteLog} />

        {/* DCA 백테스트 */}
        <BacktestTable />

        {/* 전략 원칙 */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3">
          <h2 className="text-xs font-bold flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5 text-[#f59e0b]" /> 전략 원칙 요약</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] text-[var(--text-muted)]">
            <div className="space-y-1">
              <p className="font-bold text-white">월간 DCA (평시)</p>
              <p>· QQQ 40% + TQQQ 30% + 채권 30%</p>
              <p>· 매월 15일 전후 정기 매수</p>
              <p>· 200만원/월 기준 운용</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white">하락 시 비중 확대</p>
              <p>· -3~5%: TQQQ 40%, QQQ 30%</p>
              <p>· -5~8%: TQQQ 50%, QQQ 25%</p>
              <p>· -8% 이상: TQQQ 60%, QQQ 20%</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-white">리밸런싱 조건</p>
              <p>· TQQQ 비중 42% 초과 + 하락 없을 때</p>
              <p>· 반등 +15% 이상 시 절반 익절</p>
              <p>· 연 1회 채권 비중 정기 점검</p>
            </div>
          </div>
          <p className="text-[9px] text-[#ef4444]/60 pt-1 border-t border-[var(--border)]">
            ⚠️ TQQQ는 3배 레버리지 ETF입니다. 장기 횡보장·하락장에서 변동성 감쇄로 지수보다 큰 손실이 발생할 수 있습니다. 본 페이지는 개인 투자 메모 용도이며 투자 권유가 아닙니다.
          </p>
        </div>

      </div>
    </main>
  );
}
