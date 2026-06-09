"use client";

import { useEffect, useState } from "react";
import { User, AlertTriangle, ArrowLeft, Building2, Send, ExternalLink, Loader2 } from "lucide-react";

export default function WikiPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 메인</a>
        <h1 className="text-xl font-bold mt-2">투자자 WIKI</h1>
        <p className="text-xs text-[var(--text-muted)]">주요 주주 및 투자자 관계 정보</p>
      </div>

      {!data ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div> : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* 리스트 */}
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

          {/* 상세 */}
          {selected && (
            <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[var(--accent-glow)]" />
                <h2 className="text-lg font-bold">{selected.name}</h2>
                {selected.birthDate && <span className="text-xs text-[var(--text-muted)]">{selected.birthDate}</span>}
              </div>

              <p className="text-sm leading-relaxed">{selected.context}</p>

              {/* 기업 */}
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

              {/* 패턴 */}
              {selected.patterns?.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">특이 패턴</h3>
                  {selected.patterns.map((p: string, i: number) => (
                    <div key={i} className="text-xs text-[var(--warning)]">• {p}</div>
                  ))}
                </div>
              )}

              {/* 뉴스 */}
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

              {/* 댓글 */}
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
      )}
    </div>
  );
}
