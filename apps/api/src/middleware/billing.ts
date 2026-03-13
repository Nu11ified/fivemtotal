import { Elysia } from "elysia";
import { eq, and } from "drizzle-orm";
import { db, subscriptions } from "@fivemtotal/db";
import { authMiddleware } from "./auth";

/**
 * Billing middleware: check that the user has an active paid subscription
 * with a valid billing period. Returns 401 if not authenticated, 403 if
 * the user does not have a qualifying subscription.
 *
 * Chains after authMiddleware so auth context is available.
 */
export const billingMiddleware = new Elysia({
  name: "billing-middleware",
})
  .use(authMiddleware)
  .derive({ as: "scoped" }, async ({ auth: authCtx, set }) => {
    const userId = authCtx?.userId ?? null;

    if (!userId) {
      set.status = 401;
      return { hasPaidSubscription: false };
    }

    const now = new Date();
    const sub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.userId, userId),
        eq(subscriptions.status, "active")
      ),
    });

    if (
      !sub ||
      sub.plan !== "paid" ||
      !sub.currentPeriodEnd ||
      sub.currentPeriodEnd <= now
    ) {
      set.status = 403;
      return { hasPaidSubscription: false };
    }

    return { hasPaidSubscription: true };
  });
