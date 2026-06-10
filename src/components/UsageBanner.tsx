"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

export default function UsageBanner() {
  const [warning, setWarning] = useState(false);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((d) => {
        if (d.warning || d.usagePercent >= 50) {
          setWarning(true);
          setPct(d.usagePercent);
        }
      })
      .catch(() => {});
  }, []);

  if (!warning) return null;

  return (
    <div className="bg-[var(--warning)]/10 border-b border-[var(--warning)]/20 px-4 py-2 text-center">
      <span className="text-xs text-[var(--warning)] flex items-center justify-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        한도 {pct}% 사용 (Neon DB). 수동 정리가 필요합니다: <code className="text-[var(--accent-glow)]">npm run logs -- --cleanup</code>
      </span>
    </div>
  );
}
