"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Landmark, AlertTriangle, ArrowLeft, Building2, User, Loader2, Shield } from "lucide-react";
import VoteWidget from "@/components/VoteWidget";

export default function FundDetailPage() {
  const params = useParams();
  const uid = params.uid as string;
  const [fund, setFund] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/fund/${uid}`)
      .then((r) => r.json())
      .then(setFund)
      .finally(() => setLoading(false));
  }, [uid]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[var(--accent-glow)]" /></div>;
  if (!fund || fund.error) return <div className="text-center py-20"><p className="text-[var(--text-muted)]">법인 정보를 찾을 수 없습니다</p><a href="/" className="text-[var(--accent-glow)] text-sm mt-2 inline-block">← 검색</a></div>;

  const typeLabels: Record<string, string> = {
    spc: "특수목적법인(SPC)",
    tech_assoc: "신기술조합",
    invest_assoc: "투자조합",
    shell: "페이퍼컴퍼니",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a href="/" className="text-[var(--text-muted)] hover:text-[var(--text)]"><ArrowLeft className="w-5 h-5" /></a>
        <h1 className="text-2xl font-bold">{fund.name}</h1>
        {fund.flags?.map((f: string) => (
          <span key={f} className={`px-2 py-0.5 rounded text-xs border ${
            f === "stock_celebrity" ? "bg-[var(--danger)]/20 text-[var(--danger-glow)] border-[var(--danger)]/30" :
            f === "shell" ? "bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30" :
            "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
          }`}>
            {f === "stock_celebrity" && <AlertTriangle className="inline w-3 h-3 mr-1" />}
            {f}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <InfoCard label="유형" value={typeLabels[fund.fundType] || fund.fundType} />
        <InfoCard label="고유 ID" value={fund.fundUid} />
        <InfoCard label="등록일" value={new Date(fund.createdAt).toLocaleDateString("ko-KR")} />
      </div>

      {/* 집단 평가 */}
      <VoteWidget entityType="fund" entityUid={fund.fundUid} entityName={fund.name} />

      {/* 관련 회사 */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> 투자/인수 회사 ({fund.corpRelations?.length || 0})</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {fund.corpRelations?.map((rel: any) => (
            <a key={rel.id} href={`/corp/${rel.corp.corpCode}`} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]">
              <div>
                <span className="text-sm font-medium">{rel.corp.companyName}</span>
                {rel.corp.isAdmin && <Shield className="inline w-3.5 h-3.5 text-[var(--danger-glow)] ml-1" />}
              </div>
              <div className="text-right">
                <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded bg-[var(--border)]">{rel.relationType}</span>
                {rel.pct && <span className="block text-[10px] text-[var(--text-muted)]">{rel.pct}%</span>}
                {rel.amount && <span className="block text-[10px] text-[var(--text-muted)]">{Number(rel.amount) / 1e8}억</span>}
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 실소유자 */}
      {fund.personRelations?.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><User className="w-4 h-4" /> 실소유/대표</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {fund.personRelations.map((rel: any) => (
              <a key={rel.id} href={`/person/${rel.person.personUid}`} className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]">
                <div>
                  <span className="text-sm font-medium">{rel.person.name}</span>
                  {rel.person.flags?.includes("stock_celebrity") && <AlertTriangle className="inline w-3 h-3 text-[var(--danger-glow)] ml-1" />}
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
          본 정보는 DART 공시 원문에 기반한 사실의 색인입니다. 모든 데이터는 원본 공시(접수번호)로 역추적 가능합니다.
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
