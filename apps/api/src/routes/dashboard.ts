import { Elysia } from "elysia";
import { eq, and, count, countDistinct, desc, inArray } from "drizzle-orm";
import {
  db,
  scanJobs,
  verdicts,
  rules,
  runtimeEvents,
  apiKeys,
  artifacts,
} from "@fivemtotal/db";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";

export const dashboardRoutes = new Elysia({ prefix: "/api/dashboard" })
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  /**
   * GET /api/dashboard/stats — Auth required.
   * Returns aggregate stats: total scans, malicious found, active rules, connected servers.
   */
  .get("/stats", async ({ auth, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!auth.userId) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    // Run all count queries in parallel
    const [totalScansResult, maliciousResult, activeRulesResult, userKeys] =
      await Promise.all([
        // Total scans for user
        db
          .select({ count: count() })
          .from(scanJobs)
          .where(eq(scanJobs.userId, auth.userId)),

        // Malicious verdicts for user's artifacts
        db
          .select({ count: count() })
          .from(verdicts)
          .innerJoin(artifacts, eq(verdicts.artifactId, artifacts.id))
          .where(
            and(
              eq(artifacts.userId, auth.userId),
              eq(verdicts.status, "malicious")
            )
          ),

        // Active rules (global count)
        db
          .select({ count: count() })
          .from(rules)
          .where(eq(rules.isActive, true)),

        // User's API keys
        db.query.apiKeys.findMany({
          where: eq(apiKeys.userId, auth.userId),
          columns: { id: true },
        }),
      ]);

    // Connected servers: count distinct api_key_ids in runtime_events for user's keys
    let connectedServers = 0;
    if (userKeys.length > 0) {
      const keyIds = userKeys.map((k) => k.id);
      const [serversResult] = await db
        .select({ count: countDistinct(runtimeEvents.apiKeyId) })
        .from(runtimeEvents)
        .where(inArray(runtimeEvents.apiKeyId, keyIds));

      connectedServers = serversResult?.count ?? 0;
    }

    return {
      totalScans: totalScansResult[0]?.count ?? 0,
      maliciousFound: maliciousResult[0]?.count ?? 0,
      activeRules: activeRulesResult[0]?.count ?? 0,
      connectedServers,
    };
  })

  /**
   * GET /api/dashboard/recent — Auth required.
   * Returns last 10 scans with verdict, last 10 runtime events for user's keys.
   */
  .get("/recent", async ({ auth, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!auth.userId) {
      set.status = 401;
      return { error: "Authentication required" };
    }

    // Recent scans with verdict
    const recentScans = await db
      .select({
        scanJob: {
          id: scanJobs.id,
          status: scanJobs.status,
          priority: scanJobs.priority,
          createdAt: scanJobs.createdAt,
          completedAt: scanJobs.completedAt,
        },
        artifact: {
          id: artifacts.id,
          originalFilename: artifacts.originalFilename,
          sha256: artifacts.sha256,
          fileSize: artifacts.fileSize,
        },
      })
      .from(scanJobs)
      .innerJoin(artifacts, eq(scanJobs.artifactId, artifacts.id))
      .where(eq(scanJobs.userId, auth.userId))
      .orderBy(desc(scanJobs.createdAt))
      .limit(10);

    // Enrich with verdicts
    const scansWithVerdicts = await Promise.all(
      recentScans.map(async (row) => {
        const verdict = await db.query.verdicts.findFirst({
          where: eq(verdicts.artifactId, row.artifact.id),
          orderBy: (v, { desc }) => [desc(v.createdAt)],
          columns: {
            status: true,
            severity: true,
            confidence: true,
            summary: true,
          },
        });
        return { ...row, verdict: verdict ?? null };
      })
    );

    // Recent runtime events for user's API keys
    const userKeys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, auth.userId),
      columns: { id: true },
    });

    let recentEvents: (typeof runtimeEvents.$inferSelect)[] = [];
    if (userKeys.length > 0) {
      const keyIds = userKeys.map((k) => k.id);
      recentEvents = await db
        .select()
        .from(runtimeEvents)
        .where(inArray(runtimeEvents.apiKeyId, keyIds))
        .orderBy(desc(runtimeEvents.createdAt))
        .limit(10);
    }

    return {
      recentScans: scansWithVerdicts,
      recentEvents,
    };
  });
