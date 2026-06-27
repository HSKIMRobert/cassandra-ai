"use client";

import { useEffect, useState } from "react";
import { Users, CheckCircle2, XCircle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

interface PersonSummary {
  id: string;
  personUid: string;
  name: string;
  birthDate?: string | null;
  bio?: string | null;
  flags: string[];
  _count: { corpRelations: number };
}

interface Group {
  id: string;
  name: string;
  personIds: string[];
  resolved: boolean;
  verdict?: string | null;
  persons: PersonSummary[];
  createdAt: string;
}

export default function SamenamePage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [unresolvedOnly, setUnresolvedOnly] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      if (email && ADMIN_EMAILS.includes(email)) {
        setAuthorized(true);
        fetchGroups(1, true);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchGroups = async (p: number, unresolved: boolean) => {
    setLoading(true);
    const res = await fetch(`/api/admin/samename?page=${p}&unresolved=${unresolved ? "1" : "0"}`);
    const data = await res.json();
    setGroups(data.groups ?? []);
    setTotal(data.total ?? 0);
    setPage(p);
    setLoading(false);
  };

  const handleFilter = (unresolved: boolean) => {
    setUnresolvedOnly(unresolved);
    fetchGroups(1, unresolved);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">로딩 중...</div>;
  if (!authorized) return <div className="min-h-screen flex items-center justify-center text-[#ef4444]">관리자 권한이 없습니다.</div>;

  const verdictIcon = (g: Group) => {
    if (!g.resolved) return <span className="text-[#f59e0b] text-[10px] flex items-center gap-1"><Clock className="w-3 h-3" /> 미검토</span>;
    if (g.verdict === "SAME") return <span className="text-[#22c55e] text-[10px] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> 동일인 확정</span>;
    if (g.verdict === "DIFFERENT") return <span className="text-[#3b82f6] text-[10px] flex items-center gap-1"><XCircle className="w-3 h-3" /> 다른 사람</span>;
    return <span className="text-[var(--text-muted)] text-[10px]">보류</span>;
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[#f59e0b]" />
          <h1 className="text-lg font-bold">동명이인 검토</h1>
          <span className="text-[11px] text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-full">총 {total}개 그룹</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleFilter(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${unresolvedOnly ? "bg-[#f59e0b] text-black" : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--border)]"}`}
          >
            미검토만
          </button>
          <button
            onClick={() => handleFilter(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!unresolvedOnly ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--border)]"}`}
          >
            전체
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          {unresolvedOnly ? "미검토 그룹이 없습니다 ✅" : "동명이인 그룹이 없습니다"}
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/admin/samename/${g.id}`}
              className="block rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">{g.name}</span>
                  <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded-full">{g.personIds.length}명</span>
                </div>
                <div className="flex items-center gap-3">
                  {verdictIcon(g)}
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.persons.map((p) => (
                  <div key={p.id} className="text-[10px] bg-[var(--bg)] rounded px-2 py-1 text-[var(--text-muted)]">
                    {p.name}
                    {p.birthDate && <span className="ml-1 text-[9px]">({p.birthDate})</span>}
                    <span className="ml-1 text-[var(--accent-glow)]">관계 {p._count.corpRelations}건</span>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => fetchGroups(p, unresolvedOnly)}
              className={`w-8 h-8 rounded-lg text-xs font-medium ${p === page ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--border)]"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
