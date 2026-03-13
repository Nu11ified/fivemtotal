import { Elysia } from "elysia";
import { eq } from "drizzle-orm";
import { RATE_LIMITS } from "@fivemtotal/shared";
import { db, apiKeys } from "@fivemtotal/db";
import type { AuthContext } from "./auth";
import { authMiddleware } from "./auth";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * In-memory token bucket store.
 * Single-process constraint for v1 -- not Redis-backed.
 */
const buckets = new Map<string, TokenBucket>();

const DEFAULT_AUTH: AuthContext = {
  userId: null,
  tier: "free",
  role: "user",
  isSession: false,
};

/**
 * Determine the rate limit config for a given auth context.
 * Returns { reqPerMin, key } for the token bucket.
 */
function getRateLimitConfig(
  authCtx: AuthContext,
  ip: string,
  path: string
): { reqPerMin: number; key: string } {
  // Admin endpoints
  if (path.startsWith("/api/admin") && authCtx.userId) {
    return {
      reqPerMin: RATE_LIMITS.ADMIN.reqPerMin,
      key: `admin:${authCtx.userId}`,
    };
  }

  // Guard endpoints
  if (path.startsWith("/api/guard") && authCtx.apiKeyId) {
    return {
      reqPerMin: RATE_LIMITS.GUARD.reqPerMin,
      key: `guard:${authCtx.apiKeyId}`,
    };
  }

  // Authenticated via API key
  if (authCtx.userId && authCtx.apiKeyId) {
    if (authCtx.tier === "paid") {
      return {
        reqPerMin: RATE_LIMITS.PAID_API_KEY.reqPerMin,
        key: `paid:${authCtx.userId}`,
      };
    }
    return {
      reqPerMin: RATE_LIMITS.FREE_API_KEY.reqPerMin,
      key: `free:${authCtx.userId}`,
    };
  }

  // Authenticated via session (web UI)
  if (authCtx.userId && authCtx.isSession) {
    return {
      reqPerMin: RATE_LIMITS.WEB_UI_SESSION.reqPerMin,
      key: `session:${authCtx.userId}`,
    };
  }

  // Unauthenticated
  return {
    reqPerMin: RATE_LIMITS.UNAUTHENTICATED.reqPerMin,
    key: `anon:${ip}`,
  };
}

/**
 * Consume a token from the bucket. Returns true if allowed, false if rate limited.
 */
function consumeToken(key: string, reqPerMin: number): boolean {
  const now = Date.now();
  const refillRate = reqPerMin / 60; // tokens per second
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: reqPerMin, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  bucket.tokens = Math.min(reqPerMin, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return false;
  }

  bucket.tokens -= 1;
  return true;
}

/**
 * Check the DB-backed daily scan counter for free API keys.
 * Returns true if the scan is allowed, false if daily limit exceeded.
 */
async function checkDailyScanLimit(apiKeyId: string): Promise<boolean> {
  const apiKeyRow = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, apiKeyId),
  });

  if (!apiKeyRow) return false;

  // Lazy-reset daily counter
  const now = new Date();
  const resetAt = new Date(apiKeyRow.dailyUsageResetAt);
  const elapsed = now.getTime() - resetAt.getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  let currentCount = apiKeyRow.dailyUsageCount;
  if (elapsed >= twentyFourHours) {
    await db
      .update(apiKeys)
      .set({ dailyUsageCount: 0, dailyUsageResetAt: now })
      .where(eq(apiKeys.id, apiKeyId));
    currentCount = 0;
  }

  return currentCount < RATE_LIMITS.FREE_API_KEY.scansPerDay;
}

/**
 * Increment the daily scan counter for an API key.
 */
export async function incrementDailyScanCount(apiKeyId: string): Promise<void> {
  const apiKeyRow = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, apiKeyId),
  });
  if (!apiKeyRow) return;

  await db
    .update(apiKeys)
    .set({ dailyUsageCount: apiKeyRow.dailyUsageCount + 1 })
    .where(eq(apiKeys.id, apiKeyId));
}

/**
 * Rate limit middleware using in-memory token bucket.
 * Chains after authMiddleware so auth context is available.
 */
export const rateLimitMiddleware = new Elysia({
  name: "rate-limit-middleware",
})
  .use(authMiddleware)
  .derive({ as: "scoped" }, async ({ auth: authCtx, request, set, headers }) => {
    const authResolved = authCtx ?? DEFAULT_AUTH;
    const url = new URL(request.url);
    const ip =
      headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
      headers["x-real-ip"] ??
      "unknown";

    const { reqPerMin, key } = getRateLimitConfig(authResolved, ip, url.pathname);
    const allowed = consumeToken(key, reqPerMin);

    if (!allowed) {
      set.status = 429;
      set.headers["retry-after"] = "60";
    }

    // Provide a helper to check daily scan limit (used by scan routes)
    const checkScanLimit = async (): Promise<boolean> => {
      if (!authResolved.apiKeyId) return true; // session users have no scan limit
      if (authResolved.tier === "paid") return true; // paid keys have no daily scan limit
      return checkDailyScanLimit(authResolved.apiKeyId);
    };

    return { rateLimited: !allowed, checkScanLimit };
  });
