/**
 * In-memory token-bucket rate limiter.
 *
 * Scope: per Vercel serverless instance. This is intentional — we don't have a
 * Redis dependency, and the goal here (per Iteration 12 backlog) is to keep
 * polling endpoints from being trivially abused, not to provide a hard
 * cluster-wide quota. Multiple instances will each maintain their own bucket;
 * the practical effect is N× the configured rate, where N is the cold instance
 * count. For polling at 3 s intervals from a normal session that is fine.
 *
 * Buckets are addressed by an arbitrary key string — typically `ip:route` or
 * `userId:route`. The map self-trims when over MAX_BUCKETS to bound memory.
 */

type Bucket = {
  /** Tokens currently available. Decremented on every successful consume(). */
  tokens: number
  /** Last refill timestamp in ms (Date.now()). */
  updatedAt: number
}

export type RateLimitOptions = {
  /** Total tokens the bucket holds when full. */
  capacity: number
  /** Tokens added per second; supports fractional refill (e.g. 0.5 = 1 / 2s). */
  refillPerSecond: number
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  /** Seconds until the bucket has 1 free token; 0 when allowed. */
  retryAfter: number
}

const MAX_BUCKETS = 5_000
const buckets = new Map<string, Bucket>()

/**
 * Try to consume one token from the bucket identified by `key`.
 *
 * Returns { allowed: true } when a token was consumed. Otherwise
 * { allowed: false, retryAfter } indicating how many whole seconds the
 * caller should wait before retrying (always >= 1).
 */
export function consumeToken(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  if (options.capacity <= 0 || options.refillPerSecond <= 0) {
    // Misconfiguration: don't block, just let the request through.
    return { allowed: true, remaining: options.capacity, retryAfter: 0 }
  }

  const now = Date.now()
  let bucket = buckets.get(key)

  if (!bucket) {
    // Trim the map if it's grown unbounded — drop the oldest 10% by updatedAt.
    if (buckets.size >= MAX_BUCKETS) {
      const entries = Array.from(buckets.entries())
      entries.sort((a, b) => a[1].updatedAt - b[1].updatedAt)
      const toDrop = Math.ceil(MAX_BUCKETS * 0.1)
      for (let i = 0; i < toDrop; i += 1) {
        buckets.delete(entries[i][0])
      }
    }
    bucket = { tokens: options.capacity, updatedAt: now }
    buckets.set(key, bucket)
  } else {
    // Refill based on elapsed time, capped at capacity.
    const elapsedMs = now - bucket.updatedAt
    const refill = (elapsedMs / 1000) * options.refillPerSecond
    bucket.tokens = Math.min(options.capacity, bucket.tokens + refill)
    bucket.updatedAt = now
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfter: 0,
    }
  }

  // Not enough tokens — compute wait time to next whole token.
  const deficit = 1 - bucket.tokens
  const retryAfter = Math.max(1, Math.ceil(deficit / options.refillPerSecond))
  return {
    allowed: false,
    remaining: 0,
    retryAfter,
  }
}

/**
 * Best-effort caller identifier for rate-limit keys. Prefers an
 * authenticated user id (already trustworthy), falls back to the
 * X-Forwarded-For first hop, then to a fixed bucket so misconfigured
 * deployments still get *some* protection.
 */
export function getClientKey(
  request: Request,
  userId: string | null
): string {
  if (userId) return `user:${userId}`
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return `ip:${first}`
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return `ip:${realIp.trim()}`
  return 'anon:shared'
}
