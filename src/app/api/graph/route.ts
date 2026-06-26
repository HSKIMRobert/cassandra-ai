import { NextRequest, NextResponse } from "next/server";
import { buildDeepGraph } from "@/lib/graph-queries";
import { toJSON } from "@/lib/serialize";
import { getCache, setCache } from "@/lib/redis-cache";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") || "";
  const depthParam = req.nextUrl.searchParams.get("depth");
  const depth = Math.min(Math.max(parseInt(depthParam ?? "1", 10) || 1, 1), 3);
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!q.trim()) return NextResponse.json(toJSON({ nodes: [], edges: [] }));

  const normalizedQ = q.trim().toLowerCase();
  const cacheKey = `graph:${normalizedQ}:d${depth}`;

  if (!forceRefresh) {
    const cached = await getCache(cacheKey);
    if (cached) {
      return NextResponse.json(toJSON({
        ...cached.data,
        cached: true,
        cacheAge: Math.floor(cached.age / 60),
        cacheStale: cached.stale,
      }));
    }
  }

  const data = await buildDeepGraph(q.trim(), depth);
  const result = { ...data, cached: false, cacheAge: 0, cacheStale: false };

  await setCache(cacheKey, result, 30 * 60); // 30분 TTL (기존 144h → 30min)
  return NextResponse.json(toJSON(result));
}
