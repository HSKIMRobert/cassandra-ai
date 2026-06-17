"use client";

import BoardPage from "@/components/BoardPage";
import BoardChatBot from "@/components/BoardChatBot";
import { useState, useEffect } from "react";
import { Share2, Copy } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function InviteFriend() {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email || "");
      setLoading(false);
    });
  }, []);

  if (loading || !email) return null;

  const refCode = email.split("@")[0].toUpperCase();
  const inviteLink = `https://dart-monitor-pi.vercel.app/invite?email=${encodeURIComponent(email)}`;
  const shareText = `📰 CASSANDRA AI — 코스닥 DART 공시 분석 플랫폼\n\n언론·공공기관 관계자 초대 가입 링크입니다.\n가입 후 관계망 분석, 제보·분석, 인명검색을 이용하실 수 있습니다.\n\n👉 ${inviteLink}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
      <h3 className="text-xs font-bold flex items-center gap-2"><Share2 className="w-3 h-3 text-[var(--accent-glow)]" /> 친구 초대하기</h3>
      <p className="text-[10px] text-[var(--text-muted)]">내 초대 링크로 동료 기자를 초대하세요. 초대받은 사람은 Export 회원으로 가입됩니다.</p>
      <div className="bg-[var(--bg)] rounded p-2 text-[10px] text-left font-mono whitespace-pre-wrap mb-2 text-[var(--text-muted)]">{shareText}</div>
      <div className="flex gap-2">
        <input type="text" readOnly value={inviteLink} className="flex-1 px-3 py-1.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[10px] text-[var(--text-muted)]" />
        <button onClick={handleCopy} className="px-3 py-1.5 rounded bg-[var(--accent)] text-white text-xs whitespace-nowrap">
          {copied ? "✅ 복사" : <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> 복사</span>}
        </button>
      </div>
      <p className="text-[9px] text-[var(--text-muted)]">추천인 코드: <strong className="text-[var(--accent-glow)]">{refCode}</strong></p>
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
      <InviteFriend />
      <div className="p-3 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-xs text-[var(--accent-glow)] text-center">
        💡 특정 인물·법인·조합·상장 기업 관련 데이터가 부족할 경우 문의를 남기시면 데이터를 우선적으로 업데이트하겠습니다.
      </div>
    </div>
  );
}
