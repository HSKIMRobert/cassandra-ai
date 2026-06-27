"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { User, AlertTriangle, ArrowLeft, Building2, Landmark, Loader2, Shield } from "lucide-react";
import VoteWidget from "@/components/VoteWidget";

export default function PersonDetailPage() {
  const params = useParams();
  const uid = params.uid as string;
  const [person, setPerson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/person/${uid}`)
      .then((r) => r.json())
      .then(setPerson)
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--accent-glow)]" /></div>;
  if (!person || person.error) return <div className="text-center py-20"><p className="text-[var(--text-muted)]">인물 정보를 찾을 수 없습니다</p><a href="/" className="text-[var(--accent-glow)] text-sm mt-2 inline-block">← 검색</a></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a href="/" className="text-[var(--text-muted)] hover:text-[var(--text)]"><ArrowLeft className="w-5 h-5" /></a>
        <h1 className="text-2xl font-bold">{person.name}</h1>
        {person.flags?.map((f: string) => (
          <span key={f} className={`px-2 py-0.5 rounded text-xs border ${
            f === "stock_celebrity" ? "bg-[var(--danger)]/20 text-[var(--danger-glow)] border-[var(--danger)]/30" :
            f === "manipulation_suspect" ? "bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30" :
            "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
          }`}>
            {f === "stock_celebrity" && <AlertTriangle className="inline w-3 h-3 mr-1" />}
            {f}
          </span>
        ))}
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard label="고유 ID" value={person.personUid} />
        <InfoCard label="생년월일" value={person.birthDate || "-"} />
        <InfoCard label="별칭" value={person.aliases?.join(", ") || "-"} />
        <InfoCard label="등록일" value={new Date(person.createdAt).toLocaleDateString("ko-KR")} />
      </div>

      {/* 약력 */}
      {person.bio && (
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-1">약력</h3>
          <p className="text-sm leading-relaxed">{person.bio}</p>
        </div>
      )}

      {/* 동명이인 배너 */}
      {person.sameNameCount > 1 && (
        <div className="p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--warning)]">
            ⚠ 동명이인 {person.sameNameCount}명이 감지됐습니다. 생년월일로 구분하세요.
            {person.sameNameResolved === false && " (관리자 검토 중)"}
            {person.sameNameResolved === true && " (검토 완료)"}
          </p>
          {person.sameNameGroupId && (
            <a
              href={`/admin/samename/${person.sameNameGroupId}`}
              className="shrink-0 text-[10px] text-[var(--warning)] underline hover:opacity-80"
            >
              관리자 검토
            </a>
          )}
        </div>
      )}

      {/* 집단 평가 */}
      <VoteWidget entityType="person" entityUid={person.personUid} entityName={person.name} />

      {/* 관련 회사 */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> 관련 회사 ({person.corpRelations?.length || 0})</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {person.corpRelations?.map((rel: any) => (
            <a key={rel.id} href={`/corp/${rel.corp.corpCode}`} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]">
              <div>
                <span className="text-sm font-medium">{rel.corp.companyName}</span>
                {rel.corp.isAdmin && <Shield className="inline w-3.5 h-3.5 text-[var(--danger-glow)] ml-1" />}
              </div>
              <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded bg-[var(--border)]">{rel.role}</span>
            </a>
          ))}
        </div>
      </section>

      {/* 관련 법인 (실소유) */}
      {person.fundRelations?.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Landmark className="w-4 h-4" /> 실소유/대표 법인</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {person.fundRelations.map((rel: any) => (
              <a key={rel.id} href={`/fund/${rel.fund.fundUid}`} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]">
                <div>
                  <span className="text-sm font-medium">{rel.fund.name}</span>
                  {rel.fund.flags?.includes("stock_celebrity") && <AlertTriangle className="inline w-3 h-3 text-[var(--danger-glow)] ml-1" />}
                </div>
                <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded bg-[var(--border)]">{rel.role}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 법적 고지 */}
      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--warning)]">※ CASSANDRA AI</strong> —
          본 정보는 DART 공시 원문에 기반한 사실의 색인입니다. 인물에 대한 어떠한 평가적 표현도 포함하지 않습니다.
          모든 데이터는 원본 공시(접수번호)로 역추적 가능합니다.
        </p>
        <div className="flex items-center gap-3 pt-1 border-t border-[var(--border)]">
          <a href="https://github.com/gameworkerkim/vibe-investing" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--accent-glow)] hover:underline">github.com/gameworkerkim/vibe-investing</a>
          <span className="text-[var(--border)]">|</span>
          <a href="https://dart.fss.or.kr" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text)]">DART 전자공시</a>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
      <p className="text-[10px] text-[var(--text-muted)] uppercase">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}
