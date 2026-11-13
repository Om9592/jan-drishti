import "server-only";

/**
 * Lightweight fixed-window rate limiter.
 *
 * In-memory by design: it protects a single server instance and is the
 * correct layer for preview/self-hosted deployments. On multi-instance
 * serverless, point `RATE_LIMIT_BACKEND=upstash` at a shared store (see
 * README, "Rate limiting") — the interface below stays the same.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __jdRateBuckets: Map<string, Bucket> | undefined;
}

function buckets(): Map<string, Bucket> {
  if (!globalThis.__jdRateBuckets) globalThis.__jdRateBuckets = new Map();
  return globalThis.__jdRateBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const store = buckets();
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return { allowed, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
