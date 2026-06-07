"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { downloadMarkdown } from "@/lib/export-report";
import {
  ArrowLeft, Download, FileText, Building2, AlertTriangle, ShieldAlert,
  TrendingDown, Loader2,
} from "lucide-react";

export default function ReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const itemsParam = searchParams.get("items");
    if (!itemsParam) {
      setLoading(false);
      return;
    }

    const items = itemsParam.split(",").map((seg) => {
      const [type, label, uid] = seg.split(":").map(decodeURIComponent);
      return { id: `${type}-${label}`, type, label: label || "", uid: uid || label || "" };
    }).filter((i) => i.type && i.label && i.type !== "undefined");

    fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError("리포트 생성 중 오류 발생. 서버가 실행 중인지 확인하세요.");
        console.error(err);
        setLoading(false);
      });
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-glow)]" />
        <span className="ml-3 text-[var(--text-muted)]">리포트 생성 중...</span>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="text-center py-20 space-y-4">
        <FileText className="w-12 h-12 mx-auto text-[var(--text-muted)] opacity-30" />
        <p className="text-[var(--text-muted)]">{error || "핀보드에서 분석 대상을 선택한 후 리포트를 생성하세요"}</p>
        <button onClick={() => router.push("/")} className="text-[var(--accent-glow)] text-sm hover:underline">
          ← 메인으로
        </button>
      </div>
    );
  }

  const { pinnedItems, relatedCorps, summary } = report;

  const formatKRW = (n: number) => {
    if (!n) return "-";
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
    return `${(n / 1e8).toFixed(0)}억`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">이상 징후 분석 리포트</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {new Date(report.generatedAt).toLocaleString("ko-KR")} · {summary.totalPinned}개 엔티티 → {summary.totalRelatedCorps}개 연관 기업
            </p>
          </div>
        </div>
        <button
          onClick={() => downloadMarkdown(report)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90"
        >
          <Download className="w-4 h-4" /> MD 다운로드
        </button>
      </div>

      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
        <h3 className="text-sm font-semibold mb-2">📌 분석 대상</h3>
        <div className="flex flex-wrap gap-2">
          {pinnedItems.map((item: any) => (
            <span key={item.id} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              item.type === "corp" ? "bg-[var(--corp-color)]/10 text-[var(--corp-color)]" :
              item.type === "person" ? "bg-[var(--person-color)]/10 text-[var(--person-color)]" :
              "bg-[var(--fund-color)]/10 text-[var(--fund-color)]"
            }`}>{item.label}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="연관 기업" value={summary.totalRelatedCorps} />
        <StatCard label="CB 발행 기업" value={summary.corpsWithCB} highlight />
        <StatCard label="고위험 (≥70%)" value={summary.highRiskCorps} danger />
        <StatCard label="분석 대상" value={summary.totalPinned} sub />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Building2 className="w-5 h-5" /> 연관 기업 분석</h2>
        {relatedCorps.map((entry: any) => {
          const c = entry.corp;
          return (
            <div key={c.corpCode} className="rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <a href={`/corp/${c.corpCode}`} target="_blank" className="text-base font-bold hover:text-[var(--accent-glow)]">{c.companyName}</a>
                    {c.isAdmin && <ShieldAlert className="w-4 h-4 text-[var(--danger-glow)]" />}
                    {c.delistedAt && <TrendingDown className="w-4 h-4 text-[var(--danger)]" />}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{c.market} · {c.stockCode || c.corpCode} · 시총 {formatKRW(c.marketCap)}원</p>
                </div>
                <span className={`text-sm font-bold ${entry.riskLevel >= 0.9 ? "text-[var(--danger-glow)]" : entry.riskLevel >= 0.7 ? "text-[var(--warning)]" : "text-[var(--text-muted)]"}`}>
                  위험도 {(entry.riskLevel * 100).toFixed(0)}%
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h5 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1.5">매칭 경로</h5>
                  {entry.matchedVia.map((rel: any, i: number) => (
                    <div key={i} className="text-xs text-[var(--text)]">
                      <span className={rel.type === "person" ? "text-[var(--person-color)]" : "text-[var(--fund-color)]"}>{rel.entity?.name}</span>
                      <span className="text-[var(--text-muted)]"> → </span>
                      <span className="text-[var(--accent-glow)]">{rel.role}</span>
                      {rel.description && <span className="text-[var(--text-muted)]"> ({rel.description})</span>}
                    </div>
                  ))}
                </div>
                {entry.cbFilings?.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1.5">💰 CB/BW 자금조달 활동</h5>
                    {entry.cbFilings.map((f: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-[var(--bg)]">
                        <span className="text-[var(--text-muted)] shrink-0 w-20">{new Date(f.date).toISOString().slice(0, 10)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--border)] text-[10px] shrink-0">{f.type}</span>
                        <span className="truncate">{f.summary || f.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                {entry.signals?.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1.5">
                      <AlertTriangle className="w-3 h-3 inline mr-1 text-[var(--danger-glow)]" />탐지 신호
                    </h5>
                    {entry.signals.map((s: any, i: number) => (
                      <div key={i} className={`p-2 rounded-lg text-xs ${s.score >= 0.9 ? "bg-[var(--danger)]/10 border border-[var(--danger)]/20" : s.score >= 0.7 ? "bg-[var(--warning)]/10 border border-[var(--warning)]/20" : "bg-[var(--bg)]"}`}>
                        <span className="font-medium">{s.ruleName}</span>
                        <span className="text-[var(--text-muted)] ml-2">{(s.score * 100).toFixed(0)}%</span>
                        {s.detail && <p className="text-[var(--text-muted)] mt-0.5">{s.detail}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          <strong className="text-[var(--warning)]">※ CASSANDRA AI</strong> —
          본 리포트는 DART 공시 사실의 색인·분석이며, 특정 개인·법인에 대한 평가가 아닙니다.
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

function StatCard({ label, value, highlight, danger, sub }: { label: string; value: number; highlight?: boolean; danger?: boolean; sub?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border ${danger ? "bg-[var(--danger)]/5 border-[var(--danger)]/20" : highlight ? "bg-[var(--accent)]/5 border-[var(--accent)]/20" : "bg-[var(--surface)] border-[var(--border)]"}`}>
      <p className="text-[10px] text-[var(--text-muted)] uppercase">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${danger ? "text-[var(--danger-glow)]" : highlight ? "text-[var(--accent-glow)]" : "text-[var(--text)]"}`}>{value}<span className="text-sm font-normal text-[var(--text-muted)]">개</span></p>
    </div>
  );
}
