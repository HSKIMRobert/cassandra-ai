import { NextRequest, NextResponse } from "next/server";
import { buildClusterGraph } from "@/lib/graph-queries";
import { toJSON } from "@/lib/serialize";

// 검색 캐시 (search API와 공유 패턴)
const CACHE_TTL = 72 * 60 * 60 * 1000;
const graphCache = new Map<string, { data: any; timestamp: number }>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!q.trim()) return NextResponse.json(toJSON({ nodes: [], edges: [] }));

  const normalizedQ = q.trim().toLowerCase();
  if (!forceRefresh) {
    const cached = graphCache.get(normalizedQ);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      return NextResponse.json(toJSON({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor(age / 1000 / 60),
        cacheStale: age > CACHE_TTL,
      }));
    }
  }

  const data = await buildClusterGraph(q.trim());
  const result = { ...data, cached: false, cacheAge: 0, cacheStale: false };

  graphCache.set(normalizedQ, { data: result, timestamp: Date.now() });
  if (graphCache.size > 100) {
    const oldest = [...graphCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) graphCache.delete(oldest[0]);
  }

  return NextResponse.json(toJSON(result));
}
