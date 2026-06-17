"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Mail, Lock, User, Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function InviteForm() {
    const params = useSearchParams();
    const router = useRouter();
    const email = params.get("email") || "";
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [name, setName] = useState("");
    const [org, setOrg] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== password2) { setError("비밀번호가 일치하지 않습니다."); return; }
        if (password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
        if (!name.trim()) { setError("이름을 입력해주세요."); return; }

        setLoading(true); setError("");
        try {
            const supabase = createSupabaseBrowser();
            const { error: signUpError } = await supabase.auth.signUp({
                email, password,
                options: { data: { name: name.trim(), organization: org.trim() } },
            });

            if (signUpError) { setError(signUpError.message); setLoading(false); return; }

            // Export 회원 등록 API 호출
            await fetch("/api/auth/export-register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, name: name.trim(), organization: org.trim() }),
            });

            setDone(true);
        } catch { setError("가입 중 오류가 발생했습니다."); }
        setLoading(false);
    };

    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="w-full max-w-sm text-center space-y-4">
                    <CheckCircle2 className="w-12 h-12 mx-auto text-[#22c55e]" />
                    <h1 className="text-lg font-bold">가입 완료!</h1>
                    <p className="text-xs text-[var(--text-muted)]">이메일 인증 후 로그인할 수 있습니다.</p>
                    <a href="/login" className="block py-2 rounded-lg bg-[var(--accent)] text-white text-sm">로그인하기</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <Shield className="w-10 h-10 mx-auto text-[#f59e0b]" />
                    <h1 className="text-lg font-bold mt-3">CASSANDRA AI 초대</h1>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Export 회원 가입</p>
                </div>

                <form onSubmit={handleSubmit} className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-3">
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">이메일</label>
                        <input type="email" value={email} disabled className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm opacity-60" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">비밀번호</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                            placeholder="6자 이상" className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">비밀번호 확인</label>
                        <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} required
                            placeholder="한번 더 입력" className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">이름</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required
                            placeholder="실명" className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">소속</label>
                        <input type="text" value={org} onChange={e => setOrg(e.target.value)}
                            placeholder="회사/기관명" className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm" />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-[#ef4444] text-xs bg-[#ef4444]/10 rounded p-2">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" /> {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading}
                        className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "가입하기"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function InvitePage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
            <InviteForm />
        </Suspense>
    );
}
