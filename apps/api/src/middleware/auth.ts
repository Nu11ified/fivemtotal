import { Elysia } from "elysia";
import { eq, and, isNull } from "drizzle-orm";
import { db, users, apiKeys, subscriptions } from "@fivemtotal/db";
import type { Tier, UserRole } from "@fivemtotal/shared";
import { auth } from "../lib/auth";

export interface AuthContext {
  userId: string | null;
  tier: Tier;
  role: UserRole;
  apiKeyId?: string;
  isSession: boolean;
}

/**
 * SHA-256 hash a raw API key string, returning the hex digest.
 */
async function hashApiKey(rawKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Lazy-reset daily usage count if the reset window has elapsed (24h).
 * Updates the row in-place -- no background sweep needed.
 */
async function lazyResetDailyUsage(apiKeyRow: {
  id: string;
  dailyUsageCount: number;
  dailyUsageResetAt: Date;
}): Promise<number> {
  const now = new Date();
  const resetAt = new Date(apiKeyRow.dailyUsageResetAt);
  const elapsed = now.getTime() - resetAt.getTime();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  if (elapsed >= twentyFourHours) {
    await db
      .update(apiKeys)
      .set({
        dailyUsageCount: 0,
        dailyUsageResetAt: now,
      })
      .where(eq(apiKeys.id, apiKeyRow.id));
    return 0;
  }

  return apiKeyRow.dailyUsageCount;
}

/**
 * Determine the effective tier for a user by checking their subscription.
 */
async function getUserTier(userId: string): Promise<Tier> {
  const now = new Date();
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, "active")
    ),
  });

  if (
    sub &&
    sub.plan === "paid" &&
    sub.currentPeriodEnd &&
    sub.currentPeriodEnd > now
  ) {
    return "paid";
  }

  return "free";
}

/**
 * Auth middleware that resolves session cookie OR Bearer API key to user context.
 * Attaches AuthContext to the Elysia request context via .derive().
 */
export const authMiddleware = new Elysia({ name: "auth-middleware" }).derive(
  { as: "scoped" },
  async ({ request, headers }): Promise<{ auth: AuthContext }> => {
    const defaultCtx: AuthContext = {
      userId: null,
      tier: "free",
      role: "user",
      isSession: false,
    };

    try {
      // 1. Check Authorization header for Bearer token (API key auth)
      const authHeader = headers["authorization"];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const rawKey = authHeader.slice(7);
        const keyHash = await hashApiKey(rawKey);

        const apiKeyRow = await db.query.apiKeys.findFirst({
          where: and(
            eq(apiKeys.keyHash, keyHash),
            eq(apiKeys.isActive, true),
            isNull(apiKeys.revokedAt)
          ),
        });

        if (!apiKeyRow) {
          return { auth: defaultCtx };
        }

        // Lazy-reset daily usage if needed
        await lazyResetDailyUsage(apiKeyRow);

        // Load the user
        const user = await db.query.users.findFirst({
          where: eq(users.id, apiKeyRow.userId),
        });

        if (!user) {
          return { auth: defaultCtx };
        }

        // Determine tier from subscription
        const tier = await getUserTier(user.id);

        return {
          auth: {
            userId: user.id,
            tier,
            role: user.role,
            apiKeyId: apiKeyRow.id,
            isSession: false,
          },
        };
      }

      // 2. No Authorization header -- check session cookie via Better Auth
      const session = await auth.api.getSession({
        headers: request.headers,
      });

      if (session?.user) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, session.user.id),
        });

        if (!user) {
          return { auth: defaultCtx };
        }

        const tier = await getUserTier(user.id);

        return {
          auth: {
            userId: user.id,
            tier,
            role: user.role,
            isSession: true,
          },
        };
      }

      return { auth: defaultCtx };
    } catch {
      return { auth: defaultCtx };
    }
  }
);
