"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, FileText, TrendingUp, CheckCircle2, Clock } from "lucide-react";

export default function BoardChatBot() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [queueCount, setQueueCount] = useState(0);

  const loadData = () => {
    fetch("/api/batch?type=done").then(r => r.json()).then(d => setResults(d.jobs || []));
    fetch("/api/batch?type=queued").then(r => r.json()).then(d => setQueueCount(d.queueCount || 0));
  };

  useEffect(() => { loadData(); }, []);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetName: input.trim(), targetType: "CORP" }),
      });
      if (res.ok) {
        setMessage(`✅ '${input.trim()}' 분석 요청 등록 완료`);
        setQueueCount(prev => prev + 1);
        setInput("");
        loadData();
      }
    } catch {
      setMessage("❌ 등록 실패");
    }
    setLoading(false);
    setTimeout(() => setMessage(""), 5000);
  };

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[var(--accent-glow)]" />
        <span className="text-sm font-semibold">분석 요청</span>
        {queueCount > 0 && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)]">
            <Clock className="w-2.5 h-2.5 inline mr-0.5" />대기 {queueCount}건
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
            placeholder="기업명 또는 인물명 입력"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button onClick={handleSubmit} disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white disabled:opacity-30">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {message && <p className="text-xs text-[var(--accent-glow)]">{message}</p>}
        <p className="text-[10px] text-[var(--text-muted)]">오전 6시 · 오후 3시 · 오후 9시 자동 분석</p>
      </div>

      {results.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted)]">완료된 분석</span>
            <a href="/board" className="text-[10px] text-[var(--accent-glow)] hover:underline">보고서 탭 →</a>
          </div>
          <div className="max-h-[220px] overflow-y-auto divide-y divide-[var(--border)]">
            {results.slice(0, 8).map((r: any) => (
              <div key={r.id} className="px-4 py-2.5 flex items-center gap-2.5">
                <span className="text-base shrink-0">{r.targetType === "PERSON" ? "👤" : "🏢"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{r.targetName}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {r.processedAt ? new Date(r.processedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </div>
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-3 h-3" /> 완료
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
