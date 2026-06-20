"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function InviteForm() {
    const params = useSearchParams();
    const router = useRouter();
    const email = params.get("email") || "";
    const [password, setPassword] = useState("");
    const [password2, setPassword2] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [checking, setChecking] = useState(true);
    const [status, setStatus] = useState<"ok" | "not_invited" | "expired" | "already_used" | "no_email">("ok");

    useEffect(() => {
        if (!email) { setStatus("no_email"); setChecking(false); return; }
        fetch(`/api/admin/invite?email=${encodeURIComponent(email)}`)
            .then(r => r.json())
            .then(d => {
                setStatus(d.approved ? "ok" : (d.reason || "not_invited"));
                setChecking(false);
            })
            .catch(() => { setStatus("not_invited"); setChecking(false); });
    }, [email]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== password2) { setError("비밀번호가 일치하지 않습니다."); return; }
        if (password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
        if (!name.trim()) { setError("이름을 입력해주세요."); return; }

        setLoading(true); setError("");

        try {
            // 1) 서버에서 Admin API로 유저 생성 + 이메일 인증 자동 완료
            const res = await fetch("/api/admin/invite", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, name: name.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "가입 중 오류가 발생했습니다.");
                setLoading(false);
                return;
            }

            // 2) 즉시 로그인 (이메일 인증 완료 상태이므로 반드시 성공)
            const supabase = createSupabaseBrowser();
            const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
            if (signInError) {
                setError("가입은 완료됐으나 로그인 실패: " + signInError.message);
                setLoading(false);
                return;
            }

            router.push("/dashboard");
        } catch { setError("가입 중 오류가 발생했습니다."); setLoading(false); }
    };

    if (checking) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
        </div>
    );

    if (status === "no_email")     return <StatusScreen icon={<AlertCircle className="w-12 h-12 text-[#ef4444]" />} title="초대 링크 오류" desc="유효한 초대 링크가 아닙니다. 관리자에게 문의하세요." />;
    if (status === "not_invited")  return <StatusScreen icon={<Shield className="w-12 h-12 text-[#ef4444]" />} title="초대되지 않은 이메일" desc={`${email}은 초대된 이메일이 아닙니다. 관리자에게 문의하세요.`} />;
    if (status === "expired")      return <StatusScreen icon={<Clock className="w-12 h-12 text-[#f59e0b]" />} title="초대 링크 만료" desc="유효기간(7일)이 지났습니다. 관리자에게 새 초대 링크를 요청하세요." />;
    if (status === "already_used") return <StatusScreen icon={<CheckCircle2 className="w-12 h-12 text-[#22c55e]" />} title="이미 가입된 초대" desc={`${email}은 이미 가입 완료된 이메일입니다.`} linkLabel="로그인하기" linkHref="/login" />;

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center">
                    <Shield className="w-10 h-10 mx-auto text-[#f59e0b]" />
                    <h1 className="text-lg font-bold mt-3">CASSANDRA AI 초대</h1>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Expert 회원 가입</p>
                </div>

                <form onSubmit={handleSubmit} className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-3">
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">이메일</label>
                        <input type="email" value={email} disabled
                            className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm opacity-60" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">이름 *</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required
                            placeholder="실명" className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">비밀번호 *</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                            placeholder="6자 이상" className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
                    </div>
                    <div>
                        <label className="text-[10px] text-[var(--text-muted)]">비밀번호 확인 *</label>
                        <input type="password" value={password2} onChange={e => setPassword2(e.target.value)} required
                            placeholder="한번 더 입력" className="w-full mt-1 px-3 py-2 rounded bg-[var(--bg)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]" />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-[#ef4444] text-xs bg-[#ef4444]/10 rounded p-2">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {error}
                        </div>
                    )}

                    <button type="submit" disabled={loading}
                        className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "가입하기"}
                    </button>
                    <p className="text-[9px] text-center text-[var(--text-muted)]">가입 즉시 로그인됩니다</p>
                </form>
            </div>
        </div>
    );
}

function StatusScreen({ icon, title, desc, linkLabel, linkHref }: {
    icon: React.ReactNode; title: string; desc: string; linkLabel?: string; linkHref?: string;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm text-center space-y-4">
                <div className="flex justify-center">{icon}</div>
                <h1 className="text-lg font-bold">{title}</h1>
                <p className="text-xs text-[var(--text-muted)]">{desc}</p>
                {linkLabel && linkHref && (
                    <a href={linkHref} className="block py-2 rounded-lg bg-[var(--accent)] text-white text-sm">{linkLabel}</a>
                )}
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
