import { Elysia, t } from "elysia";
import { eq, and } from "drizzle-orm";
import {
  db,
  resourcePolicies,
  hashReputation,
  iocIndicators,
  runtimeEvents,
} from "@fivemtotal/db";
import { guardEventSchema, LIMITS } from "@fivemtotal/shared";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { billingMiddleware } from "../middleware/billing";

export const guardRoutes = new Elysia({ prefix: "/api/guard" })
  .use(authMiddleware)
  .use(rateLimitMiddleware)
  .use(billingMiddleware)

  /**
   * GET /api/guard/policy — Requires auth (API key, paid tier).
   * Returns policy JSON with blocked domains, resource policies, and hash blacklist.
   */
  .get("/policy", async ({ auth, set, rateLimited, hasPaidSubscription }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!auth.userId || !auth.apiKeyId) {
      set.status = 401;
      return { error: "API key authentication required" };
    }

    if (!hasPaidSubscription) {
      set.status = 403;
      return { error: "Paid subscription required for guard features" };
    }

    // Query resource policies for this API key
    const policies = await db.query.resourcePolicies.findMany({
      where: eq(resourcePolicies.apiKeyId, auth.apiKeyId),
    });

    // Build resource policies map
    const resourcePolicyMap: Record<
      string,
      { allow: string[] | null; deny: string[] | null }
    > = {};
    for (const p of policies) {
      resourcePolicyMap[p.resourceName] = {
        allow: p.allowedFunctions,
        deny: p.deniedFunctions,
      };
    }

    // Query blacklisted hashes
    const blacklistedHashes = await db.query.hashReputation.findMany({
      where: eq(hashReputation.list, "blacklist"),
      columns: { sha256: true },
    });

    // Query blocked domains from IOC indicators
    const blockedDomains = await db.query.iocIndicators.findMany({
      where: eq(iocIndicators.type, "domain"),
      columns: { value: true },
    });

    return {
      default_policy: "deny",
      blocked_domains: blockedDomains.map((d) => d.value),
      resource_policies: resourcePolicyMap,
      hash_blacklist: blacklistedHashes.map((h) => h.sha256),
    };
  })

  /**
   * POST /api/guard/events — Requires auth (API key, paid tier).
   * Accept array of runtime events (max 100 per request).
   */
  .post(
    "/events",
    async ({ auth, set, body, rateLimited, hasPaidSubscription, headers }) => {
      if (rateLimited) {
        set.status = 429;
        return { error: "Rate limit exceeded" };
      }

      if (!auth.userId || !auth.apiKeyId) {
        set.status = 401;
        return { error: "API key authentication required" };
      }

      if (!hasPaidSubscription) {
        set.status = 403;
        return { error: "Paid subscription required for guard features" };
      }

      // Validate with Zod schema
      const parsed = guardEventSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        };
      }

      const { events } = parsed.data;

      // Derive server IP from the request or event data
      const serverIp =
        headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        headers["x-real-ip"] ??
        null;

      // Insert all events
      const insertValues = events.map((event) => ({
        apiKeyId: auth.apiKeyId!,
        resourceName: event.resourceName,
        eventType: event.eventType,
        functionName: event.functionName,
        details: event.details as Record<string, unknown> | undefined,
        serverIp: event.serverIp ?? serverIp,
      }));

      await db.insert(runtimeEvents).values(insertValues);

      return { inserted: events.length };
    },
    {
      body: t.Object({
        events: t.Array(
          t.Object({
            resourceName: t.String(),
            eventType: t.String(),
            functionName: t.String(),
            details: t.Optional(t.Record(t.String(), t.Unknown())),
            serverIp: t.Optional(t.String()),
          }),
          { maxItems: LIMITS.GUARD_MAX_EVENTS_PER_POST }
        ),
      }),
    }
  );
