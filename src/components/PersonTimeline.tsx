"use client";

import type { TimelineEntry } from "@/lib/graph-queries";

interface Props {
  entries: TimelineEntry[];
  personName: string;
}

const ROLE_COLOR: Record<string, string> = {
  CEO: "#e17055",
  DIRECTOR: "#6c5ce7",
  AUDITOR: "#00b894",
  LARGEST_HOLDER: "#fdcb6e",
  INSIDER: "#fd79a8",
  대표이사: "#e17055",
  사내이사: "#6c5ce7",
  사외이사: "#74b9ff",
  감사: "#00b894",
};

const SIGNAL_BADGE: Record<string, { label: string; color: string }> = {
  CB_ISSUANCE: { label: "CB발행", color: "#e17055" },
  CB_REISSUE: { label: "CB재발행", color: "#d63031" },
  CAPITAL_CHANGE: { label: "자본변동", color: "#fdcb6e" },
  NAME_CHANGE: { label: "사명변경", color: "#a29bfe" },
  AUDIT_RISK: { label: "감사리스크", color: "#fd79a8" },
  MAJOR_HOLDER_CHANGE: { label: "대주주변경", color: "#00cec9" },
  LAWSUIT: { label: "소송", color: "#e84393" },
  PAYMENT_DELAY: { label: "결제지연", color: "#d63031" },
};

function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? "#888";
}

function formatDate(d: string | null): string {
  if (!d) return "현재";
  return d.slice(0, 7).replace("-", ".");
}

export default function PersonTimeline({ entries, personName }: Props) {
  if (entries.length === 0) {
    return (
      <div className="text-xs text-[var(--text-muted)] px-4 py-6 text-center">
        이력 데이터 없음
      </div>
    );
  }

  const allYears = entries
    .flatMap(e => [e.since, e.until])
    .filter(Boolean)
    .map(d => parseInt(d!.slice(0, 4)));
  const minYear = allYears.length ? Math.min(...allYears) : new Date().getFullYear() - 5;
  const maxYear = new Date().getFullYear();
  const totalYears = maxYear - minYear + 1;

  function pct(dateStr: string | null, fallback: number): number {
    if (!dateStr) return fallback;
    const y = parseInt(dateStr.slice(0, 4));
    const m = parseInt(dateStr.slice(5, 7)) - 1;
    return Math.max(0, Math.min(100, ((y - minYear + m / 12) / totalYears) * 100));
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-[var(--text-muted)] px-1 mb-3">
        {personName} — 기업 이력 타임라인
      </div>

      <div className="relative h-5 ml-[120px] mr-2 mb-1">
        {Array.from({ length: totalYears + 1 }, (_, i) => {
          const year = minYear + i;
          const left = (i / totalYears) * 100;
          if (i % 2 !== 0 && totalYears > 8) return null;
          return (
            <span
              key={year}
              className="absolute text-[9px] text-[var(--text-muted)] -translate-x-1/2"
              style={{ left: `${left}%` }}
            >
              {year}
            </span>
          );
        })}
      </div>

      {entries.map((entry, idx) => {
        const left = pct(entry.since, 0);
        const right = 100 - pct(entry.until, 100);
        const rColor = roleColor(entry.role);

        return (
          <div key={idx} className="flex items-center gap-2 group">
            <div
              className="w-[116px] flex-shrink-0 text-right text-xs text-[var(--text)] truncate cursor-pointer hover:text-[#a29bfe] transition-colors"
              title={entry.companyName}
              onClick={() => window.open(`/corp/${entry.corpCode || encodeURIComponent(entry.companyName)}`, "_blank")}
            >
              {entry.companyName}
            </div>

            <div className="relative flex-1 h-5">
              <div className="absolute inset-0 rounded bg-[var(--border)]/20" />
              <div
                className="absolute top-1 bottom-1 rounded-full transition-all"
                style={{
                  left: `${left}%`,
                  right: `${right}%`,
                  backgroundColor: rColor,
                  opacity: 0.85,
                  minWidth: "6px",
                }}
                title={`${entry.role} ${formatDate(entry.since)} ~ ${formatDate(entry.until)}`}
              />
              {entry.signals.slice(0, 5).map((sig, si) => {
                const sigLeft = pct(sig.firedAt, 50);
                const badge = SIGNAL_BADGE[sig.type];
                return (
                  <div
                    key={si}
                    className="absolute top-0 bottom-0 flex items-center z-10"
                    style={{ left: `${sigLeft}%` }}
                    title={`${badge?.label ?? sig.type} (점수: ${sig.score.toFixed(0)})`}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full border border-[var(--bg)]"
                      style={{ backgroundColor: badge?.color ?? "#e74c3c" }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="w-[110px] flex-shrink-0 flex items-center gap-1.5">
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{ backgroundColor: rColor + "33", color: rColor }}
              >
                {entry.role}
              </span>
              {entry.isCurrent && (
                <span className="text-[9px] text-[#00b894] font-semibold">현직</span>
              )}
            </div>
          </div>
        );
      })}

      {entries.some(e => e.signals.length > 0) && (
        <div className="mt-3 pt-2 border-t border-[var(--border)] flex flex-wrap gap-2">
          {Object.entries(SIGNAL_BADGE).map(([, { label, color }]) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] text-[var(--text-muted)]">{label}</span>
            </div>
          ))}
          <span className="text-[9px] text-[var(--text-muted)] opacity-60 ml-1">= 공시 이벤트 마커</span>
        </div>
      )}
    </div>
  );
}
