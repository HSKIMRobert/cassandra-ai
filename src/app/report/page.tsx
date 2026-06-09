"use client";

import { Suspense } from "react";
import ReportContent from "./ReportContent";

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><span className="text-[var(--text-muted)]">로딩 중...</span></div>}>
      <ReportContent />
    </Suspense>
  );
}
