"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Users, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

interface ExpertInvite {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  createdBy: string;
  invitedByEmail: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export default function ExpertsPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState<ExpertInvite[]>([]);
  const [filter, setFilter] = useState<"all" | "accepted" | "pending" | "expired">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      if (email && ADMIN_EMAILS.includes(email)) {
        setAuthorized(true);
        fetchInvites();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchInvites = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/invite?list=1");
    const data = await res.json();
    setInvites(data.invites ?? []);
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">로딩 중...</div>;
  if (!authorized) return <div className="min-h-screen flex items-center justify-center text-[#ef4444]">관리자 권한이 없습니다.</div>;

  const now = new Date();
  const filtered = invites.filter(inv => {
    const accepted = !!inv.acceptedAt;
    const expired = !accepted && new Date(inv.expiresAt) < now;
    const pending = !accepted && !expired;
    if (filter === "accepted" && !accepted) return false;
    if (filter === "pending" && !pending) return false;
    if (filter === "expired" && !expired) return false;
    if (search) {
      const q = search.toLowerCase();
      return inv.email.toLowerCase().includes(q) ||
        (inv.name ?? "").toLowerCase().includes(q) ||
        (inv.invitedByEmail ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: invites.length,
    accepted: invites.filter(i => !!i.acceptedAt).length,
    pending: invites.filter(i => !i.acceptedAt && new Date(i.expiresAt) >= now).length,
    expired: invites.filter(i => !i.acceptedAt && new Date(i.expiresAt) < now).length,
  };

  const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-1.5 rounded-lg hover:bg-[var(--border)] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Users className="w-5 h-5 text-[#22c55e]" />
        <h1 className="text-lg font-bold">Expert 관리</h1>
        <span className="text-[11px] text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-full">
          총 {counts.all}명
        </span>
        <button onClick={fetchInvites} className="ml-auto p-1.5 rounded-lg hover:bg-[var(--border)]">
          <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        </button>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "accepted", "pending", "expired"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f
              ? f === "accepted" ? "bg-[#22c55e] text-white"
                : f === "pending" ? "bg-[#f59e0b] text-black"
                : f === "expired" ? "bg-[#ef4444] text-white"
                : "bg-[var(--accent)] text-white"
              : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--border)]"
            }`}>
            {f === "all" ? `전체 ${counts.all}` : f === "accepted" ? `가입완료 ${counts.accepted}` : f === "pending" ? `대기중 ${counts.pending}` : `만료 ${counts.expired}`}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="이메일 / 이름 / 초대자 검색"
          className="ml-auto px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-xs focus:outline-none focus:border-[var(--accent)] w-56"
        />
      </div>

      {/* 테이블 */}
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_80px] gap-3 px-4 py-2.5 text-[10px] font-semibold text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--bg)]">
          <span>이메일 / 이름</span>
          <span>연락처</span>
          <span>초대자</span>
          <span>초대일</span>
          <span>가입일</span>
          <span className="text-center">상태</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs">해당 조건의 Expert가 없습니다.</div>
        ) : (
          filtered.map(inv => {
            const accepted = !!inv.acceptedAt;
            const expired = !accepted && new Date(inv.expiresAt) < now;
            const pending = !accepted && !expired;
            const invitedBy = inv.invitedByEmail
              ? inv.invitedByEmail.split("@")[0]
              : inv.createdBy.startsWith("expert:")
              ? inv.createdBy.replace("expert:", "").split("@")[0]
              : "관리자";

            return (
              <div key={inv.id} className="grid grid-cols-[2fr_1fr_1fr_1.5fr_1fr_80px] gap-3 px-4 py-3 text-[11px] border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--border)]/20">
                <div>
                  <div className="font-medium truncate">{inv.email}</div>
                  {inv.name && <div className="text-[10px] text-[var(--text-muted)]">{inv.name}</div>}
                </div>
                <div className="text-[var(--text-muted)] text-[10px] self-center">{inv.phone ?? "-"}</div>
                <div className="text-[var(--text-muted)] text-[10px] self-center truncate">{invitedBy}</div>
                <div className="text-[var(--text-muted)] text-[10px] self-center">{fmt(inv.createdAt)}</div>
                <div className="text-[var(--text-muted)] text-[10px] self-center">
                  {accepted ? fmt(inv.acceptedAt!) : "-"}
                </div>
                <div className="flex items-center justify-center">
                  {accepted
                    ? <span className="flex items-center gap-1 text-[#22c55e] text-[10px]"><CheckCircle2 className="w-3 h-3" />가입</span>
                    : pending
                    ? <span className="flex items-center gap-1 text-[#f59e0b] text-[10px]"><Clock className="w-3 h-3" />대기</span>
                    : <span className="flex items-center gap-1 text-[#ef4444] text-[10px]"><XCircle className="w-3 h-3" />만료</span>
                  }
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
