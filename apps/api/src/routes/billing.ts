import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { db, subscriptions, apiKeys } from "@fivemtotal/db";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";

const POLAR_API_URL =
  process.env.POLAR_API_URL ?? "https://api.polar.sh/v1";
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN ?? "";
const POLAR_PRODUCT_ID = process.env.POLAR_PRODUCT_ID ?? "";
const POLAR_WEBHOOK_SECRET = process.env.POLAR_WEBHOOK_SECRET ?? "";

/**
 * Verify Polar webhook signature.
 * Polar signs webhooks with HMAC-SHA256 of the raw body using the webhook secret.
 */
async function verifyPolarSignature(
  body: string,
  signature: string
): Promise<boolean> {
  if (!POLAR_WEBHOOK_SECRET) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(POLAR_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedHex === signature;
}

export const billingRoutes = new Elysia({ prefix: "/api/billing" })
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  /**
   * POST /api/billing/checkout — Auth required.
   * Create a Polar checkout session and return the checkout URL.
   */
  .post("/checkout", async ({ auth, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!auth.userId) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    // Check if user already has an active subscription
    const existingSub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, auth.userId),
        eq(subscriptions.status, "active")
      ),
    });

    if (existingSub && existingSub.plan === "paid") {
      set.status = 400;
      return { error: "You already have an active paid subscription" };
    }

    try {
      // Create checkout session via Polar API
      const response = await fetch(`${POLAR_API_URL}/checkouts/custom`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${POLAR_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          product_id: POLAR_PRODUCT_ID,
          metadata: {
            user_id: auth.userId,
          },
          success_url: `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/billing/success`,
        }),
      });

      if (!response.ok) {
        set.status = 502;
        return { error: "Failed to create checkout session" };
      }

      const data = (await response.json()) as { url: string };
      return { checkoutUrl: data.url };
    } catch {
      set.status = 502;
      return { error: "Failed to communicate with payment provider" };
    }
  })

  /**
   * POST /api/billing/webhook — Verify Polar webhook and handle subscription events.
   * No auth middleware needed; verified by webhook signature.
   */
  .post(
    "/webhook",
    async ({ set, request, headers }) => {
      const signature = headers["x-polar-signature"] ?? "";
      const rawBody = await request.text();

      const valid = await verifyPolarSignature(rawBody, signature);
      if (!valid) {
        set.status = 401;
        return { error: "Invalid webhook signature" };
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawBody) as Record<string, unknown>;
      } catch {
        set.status = 400;
        return { error: "Invalid JSON payload" };
      }

      const eventType = payload.type as string;
      const eventData = payload.data as Record<string, unknown> | undefined;

      if (!eventData) {
        set.status = 400;
        return { error: "Missing event data" };
      }

      const metadata = eventData.metadata as Record<string, string> | undefined;
      const userId = metadata?.user_id;

      if (!userId) {
        set.status = 400;
        return { error: "Missing user_id in metadata" };
      }

      const polarSubscriptionId = eventData.id as string;
      const polarCustomerId = eventData.customer_id as string | undefined;
      const currentPeriodEnd = eventData.current_period_end
        ? new Date(eventData.current_period_end as string)
        : null;

      switch (eventType) {
        case "subscription.created": {
          // Insert subscription + update api_keys tier
          await db.insert(subscriptions).values({
            userId,
            status: "active",
            plan: "paid",
            polarCustomerId: polarCustomerId ?? null,
            polarSubscriptionId,
            currentPeriodEnd,
          });

          // Upgrade all user's API keys to paid tier
          await db
            .update(apiKeys)
            .set({ tier: "paid" })
            .where(eq(apiKeys.userId, userId));

          break;
        }

        case "subscription.updated": {
          // Update existing subscription
          const existingSub = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.polarSubscriptionId, polarSubscriptionId),
          });

          if (existingSub) {
            const newStatus = (eventData.status as string) ?? "active";
            const plan =
              newStatus === "active" ? "paid" : existingSub.plan;

            await db
              .update(subscriptions)
              .set({
                status: newStatus as "active" | "cancelled" | "past_due",
                plan: plan as "free" | "paid",
                currentPeriodEnd,
              })
              .where(eq(subscriptions.id, existingSub.id));
          }

          break;
        }

        case "subscription.cancelled": {
          // Update subscription status + downgrade api_keys tier
          const sub = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.polarSubscriptionId, polarSubscriptionId),
          });

          if (sub) {
            await db
              .update(subscriptions)
              .set({ status: "cancelled" })
              .where(eq(subscriptions.id, sub.id));

            // Downgrade all user's API keys to free tier
            await db
              .update(apiKeys)
              .set({ tier: "free" })
              .where(eq(apiKeys.userId, userId));
          }

          break;
        }

        default:
          // Unknown event type — acknowledge anyway
          break;
      }

      return { received: true };
    },
    {
      // Raw body handled via request.text() — no Elysia body schema needed for webhooks
      parse: () => {},
    }
  )

  /**
   * GET /api/billing/status — Auth required.
   * Return current subscription status from DB.
   */
  .get("/status", async ({ auth, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!auth.userId) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, auth.userId),
      orderBy: (s, { desc }) => [desc(s.createdAt)],
    });

    if (!sub) {
      return {
        subscription: null,
        tier: "free",
      };
    }

    return {
      subscription: {
        id: sub.id,
        status: sub.status,
        plan: sub.plan,
        currentPeriodEnd: sub.currentPeriodEnd,
        createdAt: sub.createdAt,
      },
      tier: sub.status === "active" && sub.plan === "paid" ? "paid" : "free",
    };
  });
