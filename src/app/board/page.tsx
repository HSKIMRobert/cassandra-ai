"use client";

import BoardPage from "@/components/BoardPage";

export default function BoardRoutePage() {
  return (
    <div className="space-y-4">
      <div>
        <a href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]">← 관계망 분석으로</a>
      </div>
      <BoardPage />
      <div className="p-3 rounded-lg bg-[var(--accent)]/5 border border-[var(--accent)]/20 text-xs text-[var(--accent-glow)] text-center">
        💡 특정 인물·법인·조합·상장 기업 관련 데이터가 부족할 경우 문의를 남기시면 데이터를 우선적으로 업데이트하겠습니다.
      </div>
    </div>
  );
}
