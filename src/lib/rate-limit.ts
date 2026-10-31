/**
 * Simple fixed-window rate limiter kept in process memory.
 *
 * Good enough for one small droplet running one Node process. If the app is
 * ever scaled to several processes, move this to Postgres or Redis.
 * Used for: sign-in link requests (per email and per IP) and anonymous guest
 * orders (per IP) — v63 let anyone create unlimited guest orders.
 */
import "server-only";
import { AppError } from "@/lib/errors";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Count one hit for `key`; throw a 429 AppError once `limit` hits happen
 * inside `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number, message?: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    sweep(now);
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    const minutes = Math.max(1, Math.ceil((bucket.resetAt - now) / 60000));
    throw new AppError(
      message ?? `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      429,
      "rate_limited",
    );
  }
}

/** Drop expired buckets now and then so the map can't grow forever. */
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** Test helper. */
export function resetRateLimits() {
  buckets.clear();
}
