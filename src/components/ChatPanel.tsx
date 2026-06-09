"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, User, Bot, Clock, ExternalLink, Building2 } from "lucide-react";

interface Message {
  role: "user" | "bot";
  content: string;
  data?: any;
}

const PERIODS = [
  { label: "1개월", value: 1 },
  { label: "3개월", value: 3 },
  { label: "6개월", value: 6 },
  { label: "12개월", value: 12 },
  { label: "24개월", value: 24 },
  { label: "36개월", value: 36 },
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(12);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, period }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [...prev, { role: "bot", content: `❌ ${data.error}` }]);
      } else {
        const { results, summary } = data;
        const knowledge = summary.knowledge;

        let botContent = "";
        if (results.length === 0 && !knowledge) {
          botContent = `'${query}'에 대한 결과를 찾지 못했습니다. 다른 이름이나 회사명으로 검색해보세요.`;
        } else {
          const parts: string[] = [];
          if (results.length > 0) {
            parts.push(`${summary.foundCompanies}개 회사에서 ${summary.totalDisclosures}건의 공시를 발견했습니다 (${summary.period} 기준)`);
          }
          botContent = parts.join("\n");
        }

        setMessages((prev) => [
          ...prev,
          { role: "bot", content: botContent, data: { results, summary, knowledge } },
        ]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "bot", content: "서버 오류가 발생했습니다." }]);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[var(--accent-glow)]" />
          <span className="text-sm font-semibold">DART 분석 챗봇</span>
        </div>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                period === p.value
                  ? "bg-[var(--accent)]/20 text-[var(--accent-glow)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="h-[300px] overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-10 text-xs text-[var(--text-muted)]">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>인물명이나 회사명을 입력하세요</p>
            <p className="mt-1">예: 씨그널엔터 김준범 관련사를 더 찾아줘</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "bot" && (
                <div className="w-6 h-6 rounded-full bg-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-[var(--accent-glow)]" />
                </div>
              )}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                msg.role === "user"
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg)] border border-[var(--border)]"
              }`}>
                <p>{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-[var(--border)] flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </div>
              )}
            </div>

            {/* 지식베이스 컨텍스트 */}
            {msg.data?.knowledge && msg.data.knowledge.length > 0 && (
              <div className="mt-2 ml-8 space-y-2">
                {msg.data.knowledge.map((kb: any, ki: number) => (
                  <div key={ki} className="p-3 rounded-lg bg-[var(--danger)]/5 border border-[var(--danger)]/20">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger-glow)]" />
                      <span className="text-xs font-bold text-[var(--danger-glow)]">{kb.name}</span>
                      {kb.flags?.map((f: string) => (
                        <span key={f} className="px-1 py-0.5 rounded text-[9px] bg-[var(--danger)]/10 text-[var(--danger-glow)]">{f}</span>
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--text)]">{kb.context}</p>
                    {kb.news?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {kb.news.map((n: any, ni: number) => (
                          <a key={ni} href={n.url} target="_blank" rel="noopener noreferrer"
                            className="block text-xs text-[var(--accent-glow)] hover:underline">
                            📰 {n.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 결과 카드 */}
            {msg.data?.results && (
              <div className="mt-2 ml-8 space-y-1.5 max-h-[200px] overflow-y-auto">
                {msg.data.results.map((r: any, j: number) => (
                  <a
                    key={j}
                    href={`/corp/${r.corpCode}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3 h-3 text-[var(--corp-color)] shrink-0" />
                        <span className="text-xs font-medium truncate">{r.companyName}</span>
                        {r.marketCap && <span className="text-[10px] text-[var(--text-muted)] shrink-0">{r.marketCap}억</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-muted)]">
                        <span className="text-[var(--person-color)]">{r.personName}</span>
                        <span>→ {r.role}</span>
                        <span className="ml-auto">{r.totalDisclosures}건 공시</span>
                      </div>
                    </div>
                    <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0 ml-1" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-3 py-2 border-t border-[var(--border)] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="예: 씨그널엔터 김준범 관련사를 더 찾아줘"
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white disabled:opacity-30 hover:opacity-90"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
