"use client";

import { useState, useEffect } from "react";
import { Send, Loader2, FileText, Copy, CheckCircle2 } from "lucide-react";

export default function BoardChatBot() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    fetch("/api/batch?type=done").then(r => r.json()).then(d => setResults(d.jobs || []));
    fetch("/api/batch?type=queued").then(r => r.json()).then(d => setQueueCount(d.queueCount || 0));
  }, []);

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
        setMessage(`✅ '${input.trim()}' 분석 요청이 게시판에 등록되었습니다.`);
        setQueueCount(prev => prev + 1);
        setInput("");
        fetch("/api/batch?type=done").then(r => r.json()).then(d => setResults(d.jobs || []));
      }
    } catch {
      setMessage("❌ 등록 실패");
    }
    setLoading(false);
    setTimeout(() => setMessage(""), 5000);
  };

  const copyReport = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <FileText className="w-4 h-4 text-[var(--accent-glow)]" />
        <span className="text-sm font-semibold">분석 요청 챗봇</span>
        {queueCount > 0 && (
          <span className="text-[10px] text-[var(--text-muted)]">(대기 {queueCount}건)</span>
        )}
      </div>

      <div className="p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
            placeholder="분석을 원하는 기업, 개인을 입력하세요"
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button onClick={handleSubmit} disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white disabled:opacity-30">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {message && (
          <p className="text-xs text-[var(--accent-glow)] mt-2">{message}</p>
        )}
      </div>

      {/* 분석 결과 */}
      {results.length > 0 && (
        <div className="border-t border-[var(--border)]">
          <div className="px-4 py-2 text-xs font-semibold text-[var(--text-muted)]">📋 자료 분석 결과 게시판</div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-[var(--border)]">
            {results.map((r: any) => (
              <div key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{r.targetName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {r.processedAt ? new Date(r.processedAt).toLocaleString("ko-KR") : ""}
                    </span>
                    <button onClick={() => copyReport(r.result || "")}
                      className="p-1 rounded hover:bg-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                      title="리포트 복사">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {r.result ? (
                  <p className="text-[10px] whitespace-pre-wrap text-[var(--text-muted)] leading-relaxed">{r.result}</p>
                ) : (
                  <p className="text-[10px] text-[var(--text-muted)]">⏳ 처리 중...</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
