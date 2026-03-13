import { Elysia, t } from "elysia";
import { eq, and } from "drizzle-orm";
import { db, apiKeys, subscriptions } from "@fivemtotal/db";
import { apiKeyCreateSchema } from "@fivemtotal/shared";
import type { Tier } from "@fivemtotal/shared";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";

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
 * Determine the tier to assign to a new API key based on user's subscription.
 */
async function getKeyTier(userId: string): Promise<Tier> {
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

export const keyRoutes = new Elysia({ prefix: "/api/keys" })
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  /**
   * POST /api/keys — Create a new API key.
   * Generates a random key, hashes it, stores the hash. Returns raw key ONCE.
   */
  .post(
    "/",
    async ({ auth, set, body, rateLimited }) => {
      if (rateLimited) {
        return { error: "Rate limit exceeded" };
      }

      if (!auth.userId) {
        set.status = 401;
        return { error: "Authentication required" };
      }

      // Validate input with Zod schema
      const parsed = apiKeyCreateSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        };
      }

      const { name } = parsed.data;
      const rawKey = crypto.randomUUID();
      const keyHash = await hashApiKey(rawKey);
      const tier = await getKeyTier(auth.userId);

      const [created] = await db
        .insert(apiKeys)
        .values({
          userId: auth.userId,
          keyHash,
          name,
          tier,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          tier: apiKeys.tier,
          createdAt: apiKeys.createdAt,
        });

      return {
        id: created.id,
        name: created.name,
        tier: created.tier,
        key: rawKey, // Returned ONCE, never stored or returned again
        createdAt: created.createdAt,
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
      }),
    }
  )

  /**
   * GET /api/keys — List the user's API keys.
   * Never returns key_hash.
   */
  .get("/", async ({ auth, set, rateLimited }) => {
    if (rateLimited) {
      return { error: "Rate limit exceeded" };
    }

    if (!auth.userId) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, auth.userId),
      columns: {
        id: true,
        name: true,
        tier: true,
        dailyUsageCount: true,
        isActive: true,
        createdAt: true,
        revokedAt: true,
      },
      orderBy: (keys, { desc }) => [desc(keys.createdAt)],
    });

    return { keys };
  })

  /**
   * DELETE /api/keys/:id — Revoke an API key.
   * Verifies the key belongs to the requesting user before revoking.
   */
  .delete("/:id", async ({ auth, set, params, rateLimited }) => {
    if (rateLimited) {
      return { error: "Rate limit exceeded" };
    }

    if (!auth.userId) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    // Verify the key belongs to the user
    const existingKey = await db.query.apiKeys.findFirst({
      where: and(eq(apiKeys.id, params.id), eq(apiKeys.userId, auth.userId)),
    });

    if (!existingKey) {
      set.status = 404;
      return { error: "API key not found" };
    }

    if (existingKey.revokedAt) {
      set.status = 400;
      return { error: "API key already revoked" };
    }

    const now = new Date();
    await db
      .update(apiKeys)
      .set({
        revokedAt: now,
        isActive: false,
        updatedAt: now,
      })
      .where(eq(apiKeys.id, params.id));

    return { success: true, id: params.id, revokedAt: now };
  });
