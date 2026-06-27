"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, XCircle, Clock, User, Building2 } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

interface CorpRelation {
  role: string;
  isCurrent: boolean;
  since?: string | null;
  until?: string | null;
  corp: { companyName: string; corpCode: string; market: string };
}

interface PersonDetail {
  id: string;
  personUid: string;
  name: string;
  birthDate?: string | null;
  bio?: string | null;
  flags: string[];
  createdAt: string;
  corpRelations: CorpRelation[];
}

interface Group {
  id: string;
  name: string;
  personIds: string[];
  resolved: boolean;
  verdict?: string | null;
  resolvedBy?: string | null;
  note?: string | null;
}

export default function SamenameDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [authorized, setAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [persons, setPersons] = useState<PersonDetail[]>([]);
  const [primaryUid, setPrimaryUid] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email;
      if (email && ADMIN_EMAILS.includes(email)) {
        setAuthorized(true);
        setAdminEmail(email);
        fetchDetail();
      } else {
        setLoading(false);
      }
    });
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/samename/${id}`);
    const data = await res.json();
    setGroup(data.group);
    setPersons(data.persons ?? []);
    if (data.persons?.length > 0) setPrimaryUid(data.persons[0].personUid);
    setLoading(false);
  };

  const handleAction = async (action: "merge" | "split" | "pending") => {
    if (action === "merge" && !primaryUid) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/samename/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, primaryPersonId: primaryUid, adminEmail }),
    });
    const data = await res.json();
    if (data.ok) {
      setResult(action === "merge" ? `✅ 병합 완료 (${data.merged}명 통합)` : action === "split" ? "✅ 다른 사람으로 분리됨" : "✅ 보류 처리됨");
      fetchDetail();
    } else {
      setResult(`❌ 오류: ${data.error}`);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">로딩 중...</div>;
  if (!authorized) return <div className="min-h-screen flex items-center justify-center text-[#ef4444]">관리자 권한이 없습니다.</div>;
  if (!group) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">그룹을 찾을 수 없습니다.</div>;

  const verdictLabel = group.resolved
    ? group.verdict === "SAME" ? "동일인 확정" : group.verdict === "DIFFERENT" ? "다른 사람" : "보류"
    : "미검토";
  const verdictColor = group.resolved
    ? group.verdict === "SAME" ? "#22c55e" : group.verdict === "DIFFERENT" ? "#3b82f6" : "#a855f7"
    : "#f59e0b";

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/samename" className="p-1.5 rounded-lg hover:bg-[var(--border)] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-lg font-bold">{group.name}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: verdictColor + "20", color: verdictColor }}>
          {verdictLabel}
        </span>
      </div>

      {result && (
        <div className="rounded-xl p-3 bg-[var(--surface)] border border-[var(--border)] text-sm font-medium">
          {result}
        </div>
      )}

      {/* 인물 비교 카드 */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(persons.length, 3)}, 1fr)` }}>
        {persons.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-4 space-y-3 cursor-pointer transition-colors ${
              primaryUid === p.personUid
                ? "border-[#22c55e] bg-[#22c55e]/5"
                : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]"
            }`}
            onClick={() => setPrimaryUid(p.personUid)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="font-semibold text-sm">{p.name}</span>
                  {primaryUid === p.personUid && (
                    <span className="text-[9px] bg-[#22c55e]/20 text-[#22c55e] px-1.5 py-0.5 rounded-full font-medium">기준</span>
                  )}
                </div>
                {p.birthDate && (
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5 ml-6">생년: {p.birthDate}</div>
                )}
              </div>
            </div>

            {p.bio && (
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{p.bio}</p>
            )}

            {p.flags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {p.flags.map((f) => (
                  <span key={f} className="text-[9px] bg-[#ef4444]/10 text-[#ef4444] px-1.5 py-0.5 rounded-full">{f}</span>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                <Building2 className="w-3 h-3" /> 소속 회사 ({p.corpRelations.length}건)
              </div>
              {p.corpRelations.slice(0, 8).map((r, i) => (
                <div key={i} className="text-[10px] py-0.5 border-b border-[var(--border)]/40 last:border-0 flex justify-between">
                  <span className={r.isCurrent ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>
                    {r.corp.companyName}
                    <span className="ml-1 text-[9px] bg-[var(--bg)] px-1 rounded">{r.role}</span>
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] shrink-0">
                    {r.since ?? "?"} {r.until ? `~${r.until}` : r.isCurrent ? "~현재" : ""}
                  </span>
                </div>
              ))}
              {p.corpRelations.length > 8 && (
                <div className="text-[9px] text-[var(--text-muted)]">+{p.corpRelations.length - 8}건 더...</div>
              )}
            </div>

            <div className="text-[9px] text-[var(--text-muted)]">UID: {p.personUid}</div>
          </div>
        ))}
      </div>

      {persons.length >= 2 && (
        <div className="text-[10px] text-[var(--text-muted)]">
          * 병합 시 선택된 <strong className="text-[#22c55e]">기준</strong> Person에 나머지가 통합됩니다. 카드를 클릭해 기준을 변경하세요.
        </div>
      )}

      {/* 판정 버튼 */}
      {!group.resolved && (
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleAction("merge")}
            disabled={submitting || persons.length < 2}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#22c55e] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#16a34a] transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            동일인 확정 — 병합
          </button>
          <button
            onClick={() => handleAction("split")}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3b82f6] text-white text-sm font-medium disabled:opacity-40 hover:bg-[#2563eb] transition-colors"
          >
            <XCircle className="w-4 h-4" />
            다른 사람 — 분리
          </button>
          <button
            onClick={() => handleAction("pending")}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-medium disabled:opacity-40 hover:bg-[var(--border)] transition-colors"
          >
            <Clock className="w-4 h-4" />
            보류
          </button>
        </div>
      )}

      {group.resolved && (
        <div className="text-[11px] text-[var(--text-muted)]">
          검토 완료: {group.resolvedBy ?? "admin"} · {group.verdict}
        </div>
      )}
    </div>
  );
}
