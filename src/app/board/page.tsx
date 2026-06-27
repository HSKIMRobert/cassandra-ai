"use client";

import BoardPage from "@/components/BoardPage";
import BoardChatBot from "@/components/BoardChatBot";
import { useState, useEffect } from "react";
import { UserPlus, Copy, CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

interface InviteRecord {
  id: string;
  email: string;
  name: string | null;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

function ExpertInviteSection() {
  const [myEmail, setMyEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sentLink, setSentLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<InviteRecord[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMyEmail(session?.user?.email || "");
      setLoading(false);
    });
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const res = await fetch("/api/expert/invite").catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setHistory(data.invites ?? []);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.includes("@")) { setError("유효한 이메일을 입력하세요."); return; }
    setSending(true); setError(""); setSentLink("");

    const res = await fetch("/api/expert/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "초대 실패");
    } else {
      setSentLink(data.link);
      setInviteEmail("");
      fetchHistory();
    }
    setSending(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !myEmail) return null;

  const now = new Date();

  return (
    <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-4">
      <h3 className="text-xs font-bold flex items-center gap-2">
        <UserPlus className="w-3.5 h-3.5 text-[#22c55e]" /> Expert 초대
      </h3>
      <p className="text-[10px] text-[var(--text-muted)]">
        초대할 이메일을 입력하면 7일간 유효한 가입 링크를 생성합니다.
      </p>

      {/* 초대 폼 */}
      <form onSubmit={handleInvite} className="flex gap-2">
        <input
          type="email"
          value={inviteEmail}
          onChange={e => { setInviteEmail(e.target.value); setError(""); }}
          placeholder="초대할 이메일 입력"
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" disabled={sending || !inviteEmail}
          className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-xs font-medium disabled:opacity-40 flex items-center gap-1.5 shrink-0">
          <Send className="w-3 h-3" />
          {sending ? "생성 중..." : "초대"}
        </button>
      </form>

      {error && <p className="text-[11px] text-[#ef4444]">{error}</p>}

      {/* 생성된 링크 */}
      {sentLink && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/20">
          <p className="flex-1 text-[10px] font-mono text-[var(--text-muted)] truncate">{sentLink}</p>
          <button onClick={() => handleCopy(sentLink)}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded bg-[#22c55e] text-white text-[10px]">
            {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
      )}

      {/* 초대 이력 */}
      {history.length > 0 && (
        <div className="space-y-1 border-t border-[var(--border)] pt-3">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] mb-2">내 초대 이력 ({history.length}건)</p>
          <div className="grid grid-cols-[1fr_60px_60px] text-[9px] text-[var(--text-muted)] pb-1 border-b border-[var(--border)]">
            <span>이메일</span><span>만료</span><span className="text-center">상태</span>
          </div>
          {history.map(inv => {
            const accepted = !!inv.acceptedAt;
            const expired = !accepted && new Date(inv.expiresAt) < now;
            return (
              <div key={inv.id} className="grid grid-cols-[1fr_60px_60px] items-center text-[10px] py-1 border-b border-[var(--border)]/40 last:border-0">
                <span className="truncate">{inv.email}{inv.name ? ` (${inv.name})` : ""}</span>
                <span className="text-[var(--text-muted)] text-[9px]">
                  {new Date(inv.expiresAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </span>
                <div className="flex justify-center">
                  {accepted
                    ? <span className="flex items-center gap-0.5 text-[#22c55e] text-[9px]"><CheckCircle2 className="w-2.5 h-2.5" />가입</span>
                    : expired
                    ? <span className="flex items-center gap-0.5 text-[#ef4444] text-[9px]"><XCircle className="w-2.5 h-2.5" />만료</span>
                    : <span className="flex items-center gap-0.5 text-[#f59e0b] text-[9px]"><Clock className="w-2.5 h-2.5" />대기</span>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BoardRoutePage() {
  return (
    <div className="space-y-4">
      <div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 관계망 분석으로</a>
      </div>
      <BoardPage />
      <BoardChatBot />
      <ExpertInviteSection />
      <div className="p-3 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-xs text-[var(--accent-glow)] text-center">
        💡 특정 인물·법인·조합·상장 기업 관련 데이터가 부족할 경우 문의를 남기시면 데이터를 우선적으로 업데이트하겠습니다.
      </div>
    </div>
  );
}
