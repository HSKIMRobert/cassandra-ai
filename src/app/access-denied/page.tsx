"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Shield, Lock } from "lucide-react";

function DeniedContent() {
  const params = useSearchParams();
  const page = params.get("page") || "";

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <Lock className="w-12 h-12 mx-auto text-[#f59e0b]" />
        <h1 className="text-lg font-bold">별도의 인증이 필요합니다</h1>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {page && <span className="block">'{page}' 페이지는 </span>}
          Expert 회원만 접근 가능합니다.<br />
          관계망 분석 · 제보·분석 · WIKI · 인명검색 기능은<br />
          관리자 승인이 필요합니다.
        </p>
        <div className="pt-2 space-y-2">
          <a href="/dashboard" className="block py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-glow)] text-sm hover:bg-[var(--accent)]/20">
            경제 지표로 이동
          </a>
          <a href="/quant" className="block py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-glow)] text-sm hover:bg-[var(--accent)]/20">
            퀀트 대시보드로 이동
          </a>
          <a href="/saju" className="block py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-glow)] text-sm hover:bg-[var(--accent)]/20">
            🔮 주식 사주로 이동
          </a>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">로딩 중...</div>}>
      <DeniedContent />
    </Suspense>
  );
}
