import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try { return await fn(); } catch { return fallback; }
};

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth) return auth;
  const today = new Date();
  const kst = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const todayStart = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000);

  // Supabase 유저 (env 없으면 빈 배열)
  let supabaseUsers: any[] = [];
  let googleUsers: any[] = [];
  let recentSignups = 0;
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (SUPABASE_URL && SERVICE_KEY) {
    await safe(async () => {
      const cookieStore = await cookies();
      const supabase = createServerClient(SUPABASE_URL, SERVICE_KEY, {
        cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
      });
      const { data } = await supabase.auth.admin.listUsers({ perPage: 100 });
      const users = data?.users || [];
      supabaseUsers = users.slice(0, 10).map((u: any) => ({ email: u.email, created_at: u.created_at }));
      googleUsers = users
        .filter((u: any) => u.identities?.some((id: any) => id.provider === "google"))
        .map((u: any) => ({ email: u.email, created_at: u.created_at, last_sign_in: u.last_sign_in_at }));
      recentSignups = users.filter((u: any) => new Date(u.created_at) >= todayStart).length;
    }, undefined);
  }

  const [
    totalUsers, totalPageviews, todayPageviews, topPages,
    uniqueTotal, uniqueToday,
    totalLogins, todayLogins, todayLoginUsers,
    totalRef, todayRef, topRefs, topStocks,
  ] = await Promise.all([
    safe(() => prisma.appUser.count(), 0),
    safe(() => prisma.pageView.count(), 0),
    safe(() => prisma.pageView.count({ where: { createdAt: { gte: todayStart } } }), 0),
    safe(() => prisma.pageView.groupBy({ by: ["path"], _count: { path: true }, orderBy: { _count: { path: "desc" } }, take: 5 }), []),
    safe(() => prisma.pageView.groupBy({ by: ["ip"], where: { ip: { not: null } } }).then(r => r.length), 0),
    safe(() => prisma.pageView.groupBy({ by: ["ip"], where: { ip: { not: null }, createdAt: { gte: todayStart } } }).then(r => r.length), 0),
    safe(() => prisma.loginHistory.count({ where: { success: true } }), 0),
    safe(() => prisma.loginHistory.count({ where: { success: true, createdAt: { gte: todayStart } } }), 0),
    safe(() => prisma.loginHistory.findMany({ where: { success: true, createdAt: { gte: todayStart } }, select: { email: true, createdAt: true }, orderBy: { createdAt: "desc" }, distinct: ["email"], take: 50 }), []),
    safe(() => prisma.referral.count(), 0),
    safe(() => prisma.referral.count({ where: { createdAt: { gte: todayStart } } }), 0),
    safe(() => prisma.referral.groupBy({ by: ["refCode"], _count: { refCode: true }, orderBy: { _count: { refCode: "desc" } }, take: 10 }), []),
    safe(() => prisma.sajuLog.groupBy({ by: ["stock"], where: { action: "stock_query", stock: { not: null } }, _count: { stock: true }, orderBy: { _count: { stock: "desc" } }, take: 10 }), []),
  ]);

  return NextResponse.json({
    totalUsers, todayLogins, totalLogins, todayPageviews, totalPageviews,
    uniqueToday, uniqueTotal, recentSignups,
    totalRef, todayRef,
    topPages: (topPages as any[]).map((p: any) => ({ path: p.path, count: p._count.path })),
    topRefs: (topRefs as any[]).map((r: any) => ({ code: r.refCode, count: r._count.refCode })),
    topStocks: (topStocks as any[]).map((s: any) => ({ stock: s.stock, count: s._count.stock })),
    supabaseUsers, googleUsers,
    todayLoginUsers: (todayLoginUsers as any[]).map((u: any) => ({ email: u.email, time: u.createdAt.toISOString() })),
  });
}
