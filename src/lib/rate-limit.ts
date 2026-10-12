import 'server-only'

/**
 * In-memory sliding-window rate limiter.
 * Suitable for this single-node sandbox deployment; swap for Redis
 * in multi-instance production deployments (documented in README).
 */
const buckets = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs)
  if (arr.length >= limit) {
    buckets.set(key, arr)
    return false
  }
  arr.push(now)
  buckets.set(key, arr)
  if (buckets.size > 10_000) {
    // occasional sweep to avoid unbounded growth
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return 'local'
}
