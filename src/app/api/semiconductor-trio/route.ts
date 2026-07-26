import { NextRequest, NextResponse } from "next/server";
import { fetchTrioData } from "@/lib/semiconductor-trio";
import { getCache } from "@/lib/redis-cache";

export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get("force") === "true";

  try {
    if (!force) {
      const cached = await getCache("semiconductor-trio:v2");
      if (cached && !cached.stale) {
        return NextResponse.json({ ...cached.data, fromCache: true, cachedSecondsAgo: cached.age });
      }
    }

    const data = await fetchTrioData();
    if (!data) {
      return NextResponse.json({ error: "데이터 수집 실패 — Yahoo Finance 또는 Toss API 오류" }, { status: 502 });
    }

    return NextResponse.json({ ...data, fromCache: false });
  } catch (e: any) {
    const stale = await getCache("semiconductor-trio:v2");
    if (stale) return NextResponse.json({ ...stale.data, fromCache: true, stale: true });
    return NextResponse.json({ error: e.message ?? "Unknown error" }, { status: 500 });
  }
}
