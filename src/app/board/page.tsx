"use client";

import BoardPage from "@/components/BoardPage";

export default function BoardRoutePage() {
  return (
    <div className="space-y-4">
      <div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 관계망 분석으로</a>
      </div>
      <BoardPage />
    </div>
  );
}
