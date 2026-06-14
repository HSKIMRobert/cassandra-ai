"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Shield, Mail, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function ExpertApplyForm() {
    const params = useSearchParams();
    const [email, setEmail] = useState("");
    const [step, setStep] = useState<"input" | "verify" | "done">("input");
    const [domainResult, setDomainResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const supabase = createSupabaseBrowser();
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user?.email) {
                setEmail(session.user.email);
                setStep("verify");
            }
        });
    }, []);

    const verifyDomain = async () => {
        setLoading(true); setError("");
        const res = await fetch("/api/auth/expert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "verify-domain", email }),
        });
        const data = await res.json();
        setDomainResult(data);
        setLoading(false);
        if (data.allowed) setStep("done");
    };

    const registerExpert = async () => {
        setLoading(true); setError("");
        const res = await fetch("/api/auth/expert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "register", email }),
        });
        const data = await res.json();
        setLoading(false);
        if (data.error) { setError(data.error); return; }
        setDomainResult(data);
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <Shield className="w-10 h-10 mx-auto text-[#f59e0b]" />
                    <h1 className="text-lg font-bold mt-3">Expert 인증</h1>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        언론·공공기관 관계자 전용
                    </p>
                </div>

                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-4">
                    {step === "input" && (
                        <>
                            <p className="text-xs text-[var(--text-muted)]">Google 로그인 후 Expert 이메일을 인증해주세요.</p>
                            <a href="/login" className="block w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium text-center">
                                로그인하기
                            </a>
                        </>
                    )}

                    {step === "verify" && (
                        <>
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <Mail className="w-3 h-3" /> {email}
                            </div>
                            {!domainResult ? (
                                <button onClick={verifyDomain} disabled={loading}
                                    className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "이메일 도메인 검증"}
                                </button>
                            ) : domainResult.allowed ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-[#22c55e] text-xs bg-[#22c55e]/10 rounded p-2">
                                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                                        {domainResult.message}
                                    </div>
                                    <button onClick={registerExpert} disabled={loading}
                                        className="w-full py-2.5 rounded-lg bg-[#f59e0b] text-black text-sm font-medium disabled:opacity-50">
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : <span className="flex items-center justify-center gap-2">Expert 등록 <ArrowRight className="w-3 h-3" /></span>}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2 text-[#ef4444] text-xs bg-[#ef4444]/10 rounded p-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-semibold">인증 불가</p>
                                        <p>{domainResult.message}</p>
                                        <p className="mt-1 text-[var(--text-muted)]">
                                            허용 도메인: 언론사(@jtbc.co.kr, @sbs.co.kr 등) · 공공기관(@police.go.kr, @spo.go.kr 등)
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {step === "done" && domainResult?.ok && (
                        <div className="space-y-3 text-center">
                            <CheckCircle2 className="w-10 h-10 mx-auto text-[#22c55e]" />
                            <p className="text-sm font-semibold">Expert 등록 완료!</p>
                            <p className="text-xs text-[var(--text-muted)]">{domainResult.message}</p>
                            <a href="/" className="block py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent-glow)] text-sm">
                                관계망 분석 시작하기
                            </a>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center gap-2 text-[#ef4444] text-xs bg-[#ef4444]/10 rounded p-2">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
                        </div>
                    )}
                </div>

                <div className="text-center text-[10px] text-[var(--text-muted)] leading-relaxed">
                    <p>Expert 인증은 언론사·공공기관 이메일만 가능합니다.</p>
                    <p>6개월마다 재인증이 필요하며, OTP 이메일로 인증합니다.</p>
                    <p className="mt-1">허용 도메인: 경찰청·검찰청·국회·법원·금융위·금감원·한국거래소·각 언론사</p>
                </div>
            </div>
        </div>
    );
}

export default function ExpertApplyPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent-glow)]" /></div>}>
            <ExpertApplyForm />
        </Suspense>
    );
}
