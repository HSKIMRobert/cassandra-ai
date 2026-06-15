"use client";

import { useEffect, useState } from "react";
import { Shield, Users, Eye, TrendingUp, Clock } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const ADMIN_EMAILS = ["gameworker@gmail.com"];

export default function AdminPage() {
    const [authorized, setAuthorized] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createSupabaseBrowser();
        supabase.auth.getSession().then(({ data: { session } }) => {
            const email = session?.user?.email;
            if (email && ADMIN_EMAILS.includes(email)) {
                setAuthorized(true);
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
        <div className="max-w-4xl mx-auto py-6 px-4 space-y-6">
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
                    <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">{stats?.todayLoginUsers?.length || 0}명</div>
                </div>
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                    <h2 className="text-sm font-bold mb-3">🔐 Google 로그인 유저</h2>
                    {stats?.googleUsers?.length > 0 ? stats.googleUsers.map((u: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                            <span className="text-[var(--text-muted)] truncate max-w-[180px]">{u.email}</span>
                            <span className="text-[10px]">{u.last_sign_in ? new Date(u.last_sign_in).toLocaleString("ko-KR", {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "-"}</span>
                        </div>
                    )) : <p className="text-[10px] text-[var(--text-muted)]">데이터 없음</p>}
                    <div className="text-right text-[10px] text-[var(--text-muted)] mt-1">{stats?.googleUsers?.length || 0}명</div>
                </div>
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                    <h2 className="text-sm font-bold mb-3">Supabase 전체 유저</h2>
                    {stats?.supabaseUsers?.map((u: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                            <span className="text-[var(--text-muted)]">{u.email}</span>
                            <span className="text-[10px]">{new Date(u.created_at).toLocaleDateString("ko-KR")}</span>
                        </div>
                    )) || <p className="text-[10px] text-[var(--text-muted)]">데이터 없음</p>}
                </div>
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                    <h2 className="text-sm font-bold mb-3">🔗 추천인 TOP 10</h2>
                    {stats?.topRefs?.length > 0 ? stats.topRefs.map((r: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                            <span className="text-[var(--text-muted)]">{i+1}. {r.code}</span>
                            <span className="font-semibold">{r.count}명</span>
                        </div>
                    )) : <p className="text-[10px] text-[var(--text-muted)]">데이터 없음</p>}
                </div>
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                    <h2 className="text-sm font-bold mb-3">💬 사주 질문 종목 TOP 10</h2>
                    {stats?.topStocks?.length > 0 ? stats.topStocks.map((s: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs py-1 border-b border-[var(--border)] last:border-0">
                            <span className="text-[var(--text-muted)]">{i+1}. {s.stock}</span>
                            <span className="font-semibold">{s.count}회</span>
                        </div>
                    )) : <p className="text-[10px] text-[var(--text-muted)]">데이터 없음</p>}
                </div>
            </div>

            {/* Expert 승인 관리 */}
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-[#f59e0b]" /> Expert 승인 대기</h2>
                <AdminExpertList />
            </div>
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
