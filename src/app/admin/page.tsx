"use client";

import { useEffect, useState } from "react";
import { Shield, Users, Eye, TrendingUp, Clock, Link, Copy, CheckCircle2, UserPlus, RefreshCw } from "lucide-react";
import NextLink from "next/link";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

export default function AdminPage() {
    const [authorized, setAuthorized] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [adminEmail, setAdminEmail] = useState("");

    useEffect(() => {
        const supabase = createSupabaseBrowser();
        supabase.auth.getSession().then(({ data: { session } }) => {
            const email = session?.user?.email;
            if (email && ADMIN_EMAILS.includes(email)) {
                setAuthorized(true);
                setAdminEmail(email);
                fetchStats();
            } else {
                setAuthorized(false);
                setLoading(false);
            }
        });
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch("/api/admin/stats");
            const data = await res.json();
            setStats(data);
        } catch {}
        setLoading(false);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-[var(--text-muted)]">로딩 중...</div>;
    if (!authorized) return <div className="min-h-screen flex items-center justify-center text-[#ef4444]">관리자 권한이 없습니다.</div>;

    return (
        <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
            <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-[#f59e0b]" />
                <h1 className="text-xl font-bold">관리자 대시보드</h1>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<Users />} label="총 가입자" value={stats?.totalUsers ?? "-"} color="#3b82f6" />
                <StatCard icon={<Eye />} label="오늘 유니크 방문" value={`${stats?.uniqueToday ?? 0} / ${stats?.uniqueTotal ?? 0}`} color="#22c55e" />
                <StatCard icon={<TrendingUp />} label="구글 로그인(오늘/누적)" value={`${stats?.todayLogins ?? 0} / ${stats?.totalLogins ?? 0}`} color="#f59e0b" />
                <StatCard icon={<Clock />} label="초대 유입(오늘/누적)" value={`${stats?.todayRef ?? 0} / ${stats?.totalRef ?? 0}`} color="#a855f7" />
            </div>

            {/* Supabase 전체 유저 목록 */}
            <UserListSection />

            <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                    <h2 className="text-sm font-bold mb-3">페이지 방문 Top 5</h2>
                    {stats?.topPages?.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                            <span className="text-[var(--text-muted)]">{p.path}</span>
                            <span className="font-semibold">{p.count}건</span>
                        </div>
                    ))}
                </div>
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                    <h2 className="text-sm font-bold mb-3">🔐 오늘 로그인</h2>
                    {stats?.todayLoginUsers?.length > 0 ? stats.todayLoginUsers.map((u: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                            <span className="text-[var(--text-muted)] truncate max-w-[200px]">{u.email}</span>
                            <span className="text-[10px]">{new Date(u.time).toLocaleTimeString("ko-KR", {hour:"2-digit",minute:"2-digit"})}</span>
                        </div>
                    )) : <p className="text-[10px] text-[var(--text-muted)]">오늘 로그인 없음</p>}
                </div>
            </div>

            {/* 동명이인 검토 */}
            <NextLink href="/admin/samename" className="block rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[#f59e0b] transition-colors p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#f59e0b]" /> 동명이인 검토
                    </h2>
                    <span className="text-xs text-[var(--text-muted)]">→ /admin/samename</span>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">같은 이름의 인물이 동일인인지 검토하고 병합합니다.</p>
            </NextLink>

            {/* Expert 초대 링크 생성 */}
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><UserPlus className="w-4 h-4 text-[#22c55e]" /> Expert 초대</h2>
                <InviteSection adminEmail={adminEmail} />
            </div>

            {/* Expert 승인 관리 */}
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-[#f59e0b]" /> Expert 승인 대기</h2>
                <AdminExpertList />
            </div>
        </div>
    );
}

function UserListSection() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");

    const load = async () => {
        setLoading(true); setError("");
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (!res.ok) { setError(data.error || "오류"); } else { setUsers(data.users || []); }
        } catch { setError("네트워크 오류"); }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filtered = users.filter(u =>
        !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
    );

    const fmt = (d: string | null) => {
        if (!d) return "-";
        return new Date(d).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#3b82f6]" />
                    전체 유저
                    <span className="text-[10px] text-[var(--text-muted)] font-normal">({users.length}명)</span>
                </h2>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="이메일 / 이름 검색"
                        className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[10px] w-40 focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button onClick={load} className="p-1 rounded hover:bg-[var(--border)]" title="새로고침">
                        <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    </button>
                </div>
            </div>

            {loading ? (
                <p className="text-[10px] text-[var(--text-muted)] py-4 text-center">로딩 중...</p>
            ) : error ? (
                <p className="text-[10px] text-[#ef4444] py-2">{error}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                        <thead>
                            <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                                <th className="text-left py-1.5 pr-3 font-medium">이메일</th>
                                <th className="text-left py-1.5 pr-3 font-medium">이름</th>
                                <th className="text-left py-1.5 pr-3 font-medium">가입일</th>
                                <th className="text-left py-1.5 pr-3 font-medium">마지막 로그인</th>
                                <th className="text-center py-1.5 pr-3 font-medium">로그인수</th>
                                <th className="text-center py-1.5 font-medium">가입경로</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((u) => (
                                <tr key={u.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--border)]/20">
                                    <td className="py-1.5 pr-3">{u.email}</td>
                                    <td className="py-1.5 pr-3 text-[var(--text-muted)]">{u.name}</td>
                                    <td className="py-1.5 pr-3 text-[var(--text-muted)]">{fmt(u.createdAt)}</td>
                                    <td className="py-1.5 pr-3 text-[var(--text-muted)]">{fmt(u.lastSignInAt)}</td>
                                    <td className="py-1.5 pr-3 text-center font-semibold">{u.loginCount}</td>
                                    <td className="py-1.5 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                            u.provider === "google" ? "bg-[#3b82f6]/10 text-[#3b82f6]" : "bg-[#22c55e]/10 text-[#22c55e]"
                                        }`}>
                                            {u.provider === "google" ? "Google" : "초대"}
                                        </span>
                                        {!u.emailConfirmed && u.provider !== "google" && (
                                            <span className="ml-1 text-[9px] text-[#f59e0b]">미인증</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && (
                        <p className="text-center text-[10px] text-[var(--text-muted)] py-4">검색 결과 없음</p>
                    )}
                </div>
            )}
        </div>
    );
}

function AdminExpertList() {
    const [apps, setApps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminEmail, setAdminEmail] = useState("");

    useEffect(() => {
        const supabase = createSupabaseBrowser();
        supabase.auth.getSession().then(({ data: { session } }) => {
            setAdminEmail(session?.user?.email || "");
            if (session?.user?.email) {
                fetch("/api/auth/expert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", adminEmail: session.user.email }) })
                    .then(r => r.json()).then(d => { setApps(d.applications || []); setLoading(false); });
            }
        });
    }, []);

    const handleAction = async (email: string, action: "approve" | "reject") => {
        await fetch("/api/auth/expert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, email, adminEmail }) });
        setApps(apps.map(a => a.email === email ? { ...a, status: action === "approve" ? "approved_unverified" : "rejected" } : a));
    };

    if (loading) return <p className="text-[10px] text-[var(--text-muted)]">로딩 중...</p>;
    if (!apps.length) return <p className="text-[10px] text-[var(--text-muted)]">신청 내역 없음</p>;

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-[var(--text-muted)] border-b border-[var(--border)] pb-1.5 mb-1">
                <span className="w-48">이메일</span><span className="w-12">유형</span><span className="w-16">상태</span><span className="text-right">관리</span>
            </div>
            {apps.map((a: any) => (
                <div key={a.email} className="flex justify-between items-center text-[10px] py-1 border-b border-[var(--border)] last:border-0">
                    <span className="w-48 truncate">{a.email}</span>
                    <span className="w-12 text-[var(--text-muted)]">{a.category === "media" ? "언론" : "공공"}</span>
                    <span className={`w-16 ${a.status === "verified" ? "text-[#22c55e]" : a.status === "approved_unverified" ? "text-[#3b82f6]" : "text-[#f59e0b]"}`}>
                        {a.status === "verified" ? "인증완료" : a.status === "approved_unverified" ? "승인됨" : "대기"}
                    </span>
                    <span className="flex gap-1">
                        {a.status === "pending" && (
                            <>
                                <button onClick={() => handleAction(a.email, "approve")} className="px-2 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 text-[9px]">승인</button>
                                <button onClick={() => handleAction(a.email, "reject")} className="px-2 py-0.5 rounded bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 text-[9px]">거절</button>
                            </>
                        )}
                        {a.status === "approved_unverified" && <span className="text-[#3b82f6] text-[9px]">OTP 발송됨</span>}
                        {a.status === "verified" && <span className="text-[var(--text-muted)] text-[9px]">인증: {a.verifiedAt?.slice(0, 10)}</span>}
                    </span>
                </div>
            ))}
        </div>
    );
}

function InviteSection({ adminEmail }: { adminEmail: string }) {
    const [email, setEmail] = useState("");
    const [link, setLink] = useState("");
    const [expiresAt, setExpiresAt] = useState("");
    const [copiedEmail, setCopiedEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [history, setHistory] = useState<any[]>([]);

    const loadHistory = () => {
        fetch("/api/admin/invite?list=1").then(r => r.json()).then(d => setHistory(d.invites || []));
    };

    useEffect(() => { loadHistory(); }, []);

    const handleCreate = async () => {
        if (!email.trim() || !email.includes("@")) { setError("유효한 이메일을 입력하세요"); return; }
        setLoading(true); setError(""); setLink("");
        try {
            const res = await fetch("/api/admin/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), adminEmail }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error || "오류 발생"); setLoading(false); return; }
            setLink(data.link);
            setExpiresAt(data.expiresAt);
            setEmail("");
            loadHistory();
        } catch { setError("네트워크 오류"); }
        setLoading(false);
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedEmail(key);
        setTimeout(() => setCopiedEmail(""), 2000);
    };

    const makeLink = (e: string) => `https://dart-monitor-pi.vercel.app/invite?email=${encodeURIComponent(e)}`;

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
                    placeholder="초대할 이메일 입력 (예: user@naver.com)"
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button onClick={handleCreate} disabled={loading || !email.trim()}
                    className="px-4 py-2 rounded-lg bg-[#22c55e] text-white text-xs font-medium disabled:opacity-40 flex items-center gap-1.5 shrink-0">
                    <Link className="w-3.5 h-3.5" />
                    {loading ? "생성 중..." : "링크 생성"}
                </button>
            </div>
            {error && <p className="text-[11px] text-[#ef4444]">{error}</p>}

            {link && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/20">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">{link}</p>
                        <p className="text-[9px] text-[var(--text-muted)] mt-0.5">만료: {expiresAt ? new Date(expiresAt).toLocaleDateString("ko-KR") : ""} (7일)</p>
                    </div>
                    <button onClick={() => handleCopy(link, "new")}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded bg-[#22c55e] text-white text-[10px]">
                        {copiedEmail === "new" ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedEmail === "new" ? "복사됨" : "복사"}
                    </button>
                </div>
            )}

            {history.length > 0 && (
                <div className="border-t border-[var(--border)] pt-3">
                    <p className="text-[10px] font-semibold text-[var(--text-muted)] mb-2">초대 이력 ({history.length}건)</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                        <div className="grid grid-cols-[1fr_70px_60px_60px] text-[9px] text-[var(--text-muted)] pb-1 border-b border-[var(--border)]">
                            <span>이메일</span><span>만료</span><span>상태</span><span className="text-right">링크</span>
                        </div>
                        {history.map((inv: any) => {
                            const expired = new Date(inv.expiresAt) < new Date();
                            const accepted = !!inv.acceptedAt;
                            const status = accepted ? "가입완료" : expired ? "만료" : "대기";
                            const statusColor = accepted ? "text-[#22c55e]" : expired ? "text-[#ef4444]" : "text-[#f59e0b]";
                            return (
                                <div key={inv.id} className="grid grid-cols-[1fr_70px_60px_60px] items-center text-[10px] py-1 border-b border-[var(--border)]/40 last:border-0">
                                    <span className="truncate text-[var(--text)]">{inv.email}{inv.name ? ` (${inv.name})` : ""}</span>
                                    <span className="text-[var(--text-muted)]">{new Date(inv.expiresAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}</span>
                                    <span className={statusColor}>{status}</span>
                                    {!accepted && !expired ? (
                                        <button onClick={() => handleCopy(makeLink(inv.email), inv.email)}
                                            className="text-right text-[var(--accent-glow)] hover:underline flex items-center justify-end gap-0.5">
                                            {copiedEmail === inv.email ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                            복사
                                        </button>
                                    ) : <span />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value, color }: any) {
    return (
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 text-center">
            <div className="w-8 h-8 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: color + "20", color }}>
                {icon}
            </div>
            <div className="text-2xl font-bold mt-2">{value}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{label}</div>
        </div>
    );
}
