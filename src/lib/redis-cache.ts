import { Redis } from "@upstash/redis";

// Upstash Redis가 설정되어 있으면 사용, 없으면 fallback
let redis: Redis | null = null;
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (URL && TOKEN) {
  redis = new Redis({ url: URL, token: TOKEN });
}

// 인메모리 폴백 (Upstash 없을 때)
const memCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30 * 60; // 30분 (기본값)

export async function getCache(key: string): Promise<{ data: any; age: number; stale: boolean } | null> {
  try {
    if (redis) {
      const raw = await redis.get(key);
      if (!raw) return null;
      // Upstash Redis는 JSON을 자동으로 파싱할 수 있음
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      const { data, ts } = parsed;
      const age = Math.floor((Date.now() - ts) / 1000);
      return { data, age, stale: age > CACHE_TTL };
    }
    // 폴백
    const entry = memCache.get(key);
    if (!entry) return null;
    const age = Math.floor((Date.now() - entry.ts) / 1000);
    return { data: entry.data, age, stale: age > CACHE_TTL };
  } catch {
    return null;
  }
}

export async function setCache(key: string, data: any, ttlSec?: number): Promise<void> {
  try {
    const payload = JSON.stringify({ data, ts: Date.now() });
    if (redis) {
      await redis.set(key, payload, { ex: ttlSec || CACHE_TTL });
      return;
    }
    // 폴백
    memCache.set(key, { data, ts: Date.now() });
    if (memCache.size > 100) {
      const oldest = [...memCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) memCache.delete(oldest[0]);
    }
  } catch {}
}

// 검색 로그 저장 (Upstash 활용)
export async function logSearch(query: string, ip?: string): Promise<void> {
  try {
    if (redis) {
      const key = `trending:${new Date().toISOString().slice(0, 10)}:${query}`;
      await redis.incr(key);
      await redis.expire(key, CACHE_TTL);
    }
  } catch {}
}

// 실검 조회 (Upstash에서)
export async function getTrendingFromRedis(): Promise<{ query: string; count: number }[] | null> {
  if (!redis) return null;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const keys = await redis.keys(`trending:${today}:*`);
    if (!keys.length) return null;
    const results: { query: string; count: number }[] = [];
    for (const key of keys.slice(0, 30)) {
      const count = await redis.get<number>(key);
      const query = key.split(":").slice(2).join(":");
      if (query.length >= 3 && count) results.push({ query, count });
    }
    return results.sort((a, b) => b.count - a.count).slice(0, 10);
  } catch {
    return null;
  }
}
