"use client";

import { useState } from "react";
import { usePinboardStore } from "@/lib/pinboard-store";
import { downloadMarkdown } from "@/lib/export-report";
import {
  Pin, X, FileText, Download, Loader2, Building2, User, Landmark,
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function PinboardPanel() {
  const { items, removeItem, clearAll } = usePinboardStore();
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

  const handleGenerate = () => {
    if (items.length === 0) return;
    const encoded = items
      .filter((i) => i.type && i.label)
      .map((i) => `${i.type}:${encodeURIComponent(i.label)}:${encodeURIComponent(i.uid || i.label)}`)
      .join(",");
    if (!encoded) return;
    router.push(`/report?items=${encodeURIComponent(encoded)}`);
  };

  const handleDownloadMD = async () => {
    if (items.length === 0) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const report = await res.json();
      if (!report.error) {
        downloadMarkdown(report);
      } else {
        alert("리포트 생성 실패: " + report.error);
      }
    } catch (err) {
      alert("리포트 생성 중 오류 발생");
      console.error(err);
    }
    setGenerating(false);
  };

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-[var(--accent-glow)]" />
          <span className="text-xs font-semibold">핀보드</span>
          <span className="text-[10px] text-[var(--text-muted)]">({items.length})</span>
        </div>
        <button onClick={clearAll} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]">
          전체 해제
        </button>
      </div>

      <div className="p-2 space-y-1 max-h-[200px] overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--bg)] group">
            {item.type === "corp" ? (
              <Building2 className="w-3.5 h-3.5 text-[var(--corp-color)] shrink-0" />
            ) : item.type === "person" ? (
              <User className="w-3.5 h-3.5 text-[var(--person-color)] shrink-0" />
            ) : (
              <Landmark className="w-3.5 h-3.5 text-[var(--fund-color)] shrink-0" />
            )}
            <span className="text-xs truncate flex-1">{item.label}</span>
            <button
              onClick={() => removeItem(item.id)}
              className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--border)] transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-[var(--border)] flex gap-2">
        <button
          onClick={handleGenerate}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <FileText className="w-3.5 h-3.5" />
          리포트 보기
        </button>
        <button
          onClick={handleDownloadMD}
          disabled={generating}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)] text-xs font-medium hover:text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50 transition-colors"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          MD
        </button>
      </div>
    </div>
  );
}
