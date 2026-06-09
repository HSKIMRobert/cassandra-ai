"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import dynamic from "next/dynamic";
import {
  Building2, Calendar, FileText, AlertTriangle, TrendingDown,
  ShieldAlert, Loader2, ArrowLeft, User, Landmark,
} from "lucide-react";

const EntityGraph = dynamic(() => import("@/components/EntityGraph"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-[var(--surface)] rounded-xl border border-[var(--border)]">
      <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
    </div>
  ),
});

export default function CorpDetailPage() {
  const params = useParams();
  const code = params.code as string;
  const [corp, setCorp] = useState<any>(null);
  const [graphData, setGraphData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [corpRes, graphRes] = await Promise.all([
        fetch(`/api/corp/${code}`).then((r) => r.json()),
        fetch(`/api/graph?q=${encodeURIComponent(code)}`).then((r) => r.json()),
      ]);
      setCorp(corpRes);
      setGraphData(graphRes);
      setLoading(false);
    }
    load();
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-glow)]" />
      </div>
    );
  }

  if (!corp || corp.error) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--text-muted)]">회사 정보를 찾을 수 없습니다</p>
        <a href="/" className="text-[var(--accent-glow)] text-sm mt-2 inline-block">← 검색으로 돌아가기</a>
      </div>
    );
  }

  const formatKRW = (won: number) => {
    if (won >= 1e12) return `${(won / 1e12).toFixed(1)}조원`;
    if (won >= 1e8) return `${(won / 1e8).toFixed(0)}억원`;
    return `${won.toLocaleString()}원`;
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <a href="/" className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <h1 className="text-2xl font-bold">{corp.companyName}</h1>
        <div className="flex gap-2">
          {corp.isAdmin && (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[var(--danger)]/20 text-[var(--danger-glow)] border border-[var(--danger)]/30">
              <ShieldAlert className="w-3 h-3" /> 관리종목
            </span>
          )}
          {corp.delistedAt && (
            <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-950/50 text-[var(--danger)] border border-[var(--danger)]/30">
              <TrendingDown className="w-3 h-3" /> 상장폐지
            </span>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard label="시장" value={corp.market} />
        <InfoCard label="종목코드" value={corp.stockCode || corp.corpCode} />
        <InfoCard label="시가총액" value={corp.marketCap ? formatKRW(Number(corp.marketCap)) : "-"} />
        <InfoCard
          label="상장폐지일"
          value={corp.delistedAt ? format(new Date(corp.delistedAt), "yyyy-MM-dd") : "상장중"}
        />
      </div>

      {/* 관계망 그래프 */}
      <section>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" /> 관계망
        </h2>
        {graphData && graphData.nodes.length > 0 ? (
          <EntityGraph data={graphData} />
        ) : (
          <div className="w-full h-[300px] flex items-center justify-center bg-[var(--surface)] rounded-xl border border-[var(--border)] text-[var(--text-muted)] text-sm">
            관계망 데이터 없음
          </div>
        )}
      </section>

      {/* 인물 관계 */}
      {corp.personRelations?.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-[var(--person-color)] mb-2 flex items-center gap-2">
            <User className="w-4 h-4" /> 관련 인물
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {corp.personRelations.map((rel: any) => (
              <a
                key={rel.id}
                href={`/person/${rel.person.personUid}`}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{rel.person.name}</span>
                  {rel.person.flags?.includes("stock_celebrity") && (
                    <AlertTriangle className="inline w-3 h-3 text-[var(--danger-glow)] ml-1" />
                  )}
                </div>
                <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded bg-[var(--border)]">
                  {rel.role}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 법인/조합 관계 */}
      {corp.fundRelations?.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-[var(--fund-color)] mb-2 flex items-center gap-2">
            <Landmark className="w-4 h-4" /> 관련 법인/조합
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {corp.fundRelations.map((rel: any) => (
              <a
                key={rel.id}
                href={`/fund/${rel.fund.fundUid}`}
                className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
              >
                <div>
                  <span className="text-sm font-medium">{rel.fund.name}</span>
                  {rel.fund.flags?.includes("stock_celebrity") && (
                    <AlertTriangle className="inline w-3 h-3 text-[var(--danger-glow)] ml-1" />
                  )}
                </div>
                <span className="text-xs text-[var(--text-muted)] px-2 py-0.5 rounded bg-[var(--border)]">
                  {rel.relationType}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* 공시 타임라인 */}
      <section>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <FileText className="w-4 h-4" /> 공시 타임라인 ({corp.filings?.length || 0}건)
        </h3>
        <div className="space-y-1">
          {corp.filings?.map((f: any) => (
            <a
              key={f.id}
              href={f.sourceUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors group"
            >
              <Calendar className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.title}</p>
                {f.summary && (
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{f.summary}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <span className="text-xs text-[var(--text-muted)]">
                  {format(new Date(f.filedAt), "yyyy-MM-dd", { locale: ko })}
                </span>
                <span className="block text-[10px] text-[var(--accent-glow)]">{f.filingType}</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 신호 발화 이력 */}
      {corp.signals?.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[var(--danger-glow)]" /> 탐지 신호
          </h3>
          <div className="space-y-2">
            {corp.signals.map((s: any) => (
              <div
                key={s.id}
                className={`p-3 rounded-lg border ${
                  s.score >= 0.9
                    ? "border-[var(--danger)]/50 bg-[var(--danger)]/5"
                    : s.score >= 0.7
                    ? "border-[var(--warning)]/50 bg-[var(--warning)]/5"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.ruleName}</span>
                  <span
                    className={`text-sm font-bold ${
                      s.score >= 0.9 ? "text-[var(--danger-glow)]" : s.score >= 0.7 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {(s.score * 100).toFixed(0)}%
                  </span>
                </div>
                {s.detail && <p className="text-xs text-[var(--text-muted)] mt-1">{s.detail}</p>}
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  {format(new Date(s.firedAt), "yyyy-MM-dd HH:mm")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 법적 고지 */}
      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--warning)]">※ CASSANDRA AI</strong> —
          본 정보는 금융감독원 DART 전자공시에 제출된 사실 정보를 색인·분석한 것입니다.
          특정 개인·법인에 대한 평가가 아니며, 투자 권유가 아닙니다.
          모든 데이터 포인트는 원본 공시 접수번호(rcept_no)로 역추적 가능합니다.
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
