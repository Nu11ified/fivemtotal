import { Elysia, t } from "elysia";
import { eq, and, or, count, desc } from "drizzle-orm";
import {
  db,
  artifacts,
  scanJobs,
  findings,
  verdicts,
  reviewActions,
  rules,
  hashReputation,
  auditLogs,
} from "@fivemtotal/db";
import { ruleSchema, verdictSchema } from "@fivemtotal/shared";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { requireRole } from "../middleware/role";
import { sanitizeHtml } from "../lib/sanitize";

export const adminRoutes = new Elysia({ prefix: "/api/admin" })
  .use(authMiddleware)
  .use(rateLimitMiddleware)
  .use(requireRole("analyst"))

  /**
   * GET /api/admin/queue — Verdicts with status 'suspicious' or 'unknown',
   * ordered by severity. Joined with artifacts for metadata.
   */
  .get("/queue", async ({ auth, set, rateLimited, authorized }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!authorized) {
      return { error: "Insufficient permissions" };
    }

    const rows = await db
      .select({
        verdict: verdicts,
        artifact: {
          id: artifacts.id,
          originalFilename: artifacts.originalFilename,
          sha256: artifacts.sha256,
          fileSize: artifacts.fileSize,
          createdAt: artifacts.createdAt,
        },
      })
      .from(verdicts)
      .innerJoin(artifacts, eq(verdicts.artifactId, artifacts.id))
      .where(
        or(
          eq(verdicts.status, "suspicious"),
          eq(verdicts.status, "unknown")
        )
      )
      .orderBy(verdicts.severity);

    return { queue: rows };
  })

  /**
   * GET /api/admin/artifact/:id — Full artifact detail.
   * Artifact info, all scan jobs, all findings, all verdicts, verdict history.
   */
  .get("/artifact/:id", async ({ params, set, rateLimited, authorized }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!authorized) {
      return { error: "Insufficient permissions" };
    }

    const artifact = await db.query.artifacts.findFirst({
      where: eq(artifacts.id, params.id),
    });

    if (!artifact) {
      set.status = 404;
      return { error: "Artifact not found" };
    }

    // Fetch all related data in parallel
    const [jobs, allFindings, allVerdicts] = await Promise.all([
      db.query.scanJobs.findMany({
        where: eq(scanJobs.artifactId, params.id),
        orderBy: (sj, { desc }) => [desc(sj.createdAt)],
      }),
      db
        .select()
        .from(findings)
        .innerJoin(scanJobs, eq(findings.scanJobId, scanJobs.id))
        .where(eq(scanJobs.artifactId, params.id))
        .orderBy(desc(findings.createdAt)),
      db.query.verdicts.findMany({
        where: eq(verdicts.artifactId, params.id),
        orderBy: (v, { desc }) => [desc(v.createdAt)],
      }),
    ]);

    // Fetch review actions for all verdicts
    const verdictIds = allVerdicts.map((v) => v.id);
    let allReviewActions: (typeof reviewActions.$inferSelect)[] = [];
    if (verdictIds.length > 0) {
      allReviewActions = await db.query.reviewActions.findMany({
        where: or(
          ...verdictIds.map((vid) => eq(reviewActions.verdictId, vid))
        ),
        orderBy: (ra, { desc }) => [desc(ra.createdAt)],
      });
    }

    return {
      artifact,
      scanJobs: jobs,
      findings: allFindings.map((row) => row.findings),
      verdicts: allVerdicts,
      reviewActions: allReviewActions,
    };
  })

  /**
   * POST /api/admin/verdict/:id — Update verdict.
   * Insert review_actions row, audit_logs row. If blacklisting: insert/update hash_reputation.
   */
  .post(
    "/verdict/:id",
    async ({ params, body, auth, set, rateLimited, authorized, headers }) => {
      if (rateLimited) {
        set.status = 429;
        return { error: "Rate limit exceeded" };
      }

      if (!authorized || !auth.userId) {
        return { error: "Insufficient permissions" };
      }

      // Validate the verdict update body
      const parsed = verdictSchema
        .pick({ status: true, severity: true, confidence: true, summary: true })
        .safeParse(body);

      if (!parsed.success) {
        set.status = 400;
        return {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        };
      }

      // Find existing verdict
      const existingVerdict = await db.query.verdicts.findFirst({
        where: eq(verdicts.id, params.id),
      });

      if (!existingVerdict) {
        set.status = 404;
        return { error: "Verdict not found" };
      }

      const previousStatus = existingVerdict.status;
      const { status, severity, confidence } = parsed.data;
      // Sanitize user-provided text to prevent stored XSS
      const summary = sanitizeHtml(parsed.data.summary);

      // Update the verdict
      await db
        .update(verdicts)
        .set({
          status,
          severity,
          confidence,
          summary,
          reviewerId: auth.userId,
          autoGenerated: false,
        })
        .where(eq(verdicts.id, params.id));

      // Determine review action from status change
      let action: "blacklist" | "warning_list" | "safe_list" | "release" | "revoke" | "escalate" = "release";
      if (status === "malicious") action = "blacklist";
      else if (status === "suspicious") action = "escalate";
      else if (status === "safe") action = "safe_list";

      // Insert review action (sanitize note to prevent stored XSS)
      const rawNote = (body as Record<string, unknown>).note as string | undefined;
      const note = rawNote ? sanitizeHtml(rawNote) : undefined;

      await db.insert(reviewActions).values({
        verdictId: params.id,
        reviewerId: auth.userId,
        action,
        previousStatus,
        newStatus: status,
        note,
      });

      // Insert audit log
      const ip =
        headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        headers["x-real-ip"] ??
        null;

      await db.insert(auditLogs).values({
        userId: auth.userId,
        action: "verdict_update",
        targetType: "verdict",
        targetId: params.id,
        details: { previousStatus, newStatus: status, severity, confidence },
        ipAddress: ip,
      });

      // If blacklisting, insert/update hash_reputation
      if (status === "malicious") {
        const artifact = await db.query.artifacts.findFirst({
          where: eq(artifacts.id, existingVerdict.artifactId),
        });

        if (artifact) {
          // Upsert hash reputation
          const existingRep = await db.query.hashReputation.findFirst({
            where: and(
              eq(hashReputation.sha256, artifact.sha256),
              eq(hashReputation.hashType, "archive")
            ),
          });

          if (existingRep) {
            await db
              .update(hashReputation)
              .set({
                list: "blacklist",
                source: "analyst",
                analystNote: summary, // already sanitized above
              })
              .where(eq(hashReputation.id, existingRep.id));
          } else {
            await db.insert(hashReputation).values({
              sha256: artifact.sha256,
              hashType: "archive",
              list: "blacklist",
              source: "analyst",
              analystNote: summary, // already sanitized above
            });
          }
        }
      }

      return {
        success: true,
        verdictId: params.id,
        previousStatus,
        newStatus: status,
      };
    },
    {
      body: t.Object({
        status: t.String(),
        severity: t.String(),
        confidence: t.Number(),
        summary: t.String(),
        note: t.Optional(t.String()),
      }),
    }
  )

  /**
   * POST /api/admin/rules — Create or update a rule.
   */
  .post(
    "/rules",
    async ({ body, auth, set, rateLimited, authorized, headers }) => {
      if (rateLimited) {
        set.status = 429;
        return { error: "Rate limit exceeded" };
      }

      if (!authorized || !auth.userId) {
        return { error: "Insufficient permissions" };
      }

      const parsed = ruleSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        };
      }

      const { name, category, severity, pattern, isActive } = parsed.data;
      // Sanitize user-provided text to prevent stored XSS
      const description = parsed.data.description
        ? sanitizeHtml(parsed.data.description)
        : undefined;

      // Check if updating an existing rule by id
      const ruleId = (body as Record<string, unknown>).id as string | undefined;
      let resultId: string;

      if (ruleId) {
        const existingRule = await db.query.rules.findFirst({
          where: eq(rules.id, ruleId),
        });

        if (!existingRule) {
          set.status = 404;
          return { error: "Rule not found" };
        }

        await db
          .update(rules)
          .set({
            name,
            description,
            category,
            severity,
            pattern,
            isActive,
            version: existingRule.version + 1,
          })
          .where(eq(rules.id, ruleId));

        resultId = ruleId;
      } else {
        const [created] = await db
          .insert(rules)
          .values({
            name,
            description,
            category,
            severity,
            pattern,
            isActive,
          })
          .returning({ id: rules.id });

        resultId = created.id;
      }

      // Insert audit log
      const ip =
        headers["x-forwarded-for"]?.split(",")[0]?.trim() ??
        headers["x-real-ip"] ??
        null;

      await db.insert(auditLogs).values({
        userId: auth.userId,
        action: ruleId ? "rule_update" : "rule_create",
        targetType: "rule",
        targetId: resultId,
        details: { name, category, severity, isActive },
        ipAddress: ip,
      });

      return {
        success: true,
        ruleId: resultId,
        action: ruleId ? "updated" : "created",
      };
    },
    {
      body: t.Object({
        id: t.Optional(t.String()),
        name: t.String(),
        description: t.Optional(t.String()),
        category: t.String(),
        severity: t.String(),
        pattern: t.Record(t.String(), t.Unknown()),
        isActive: t.Optional(t.Boolean()),
      }),
    }
  )

  /**
   * GET /api/admin/rules — List all rules, optionally filter by is_active.
   */
  .get("/rules", async ({ query, set, rateLimited, authorized }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!authorized) {
      return { error: "Insufficient permissions" };
    }

    const activeFilter = (query as Record<string, string>).is_active;

    let condition;
    if (activeFilter === "true") {
      condition = eq(rules.isActive, true);
    } else if (activeFilter === "false") {
      condition = eq(rules.isActive, false);
    }

    const allRules = await db.query.rules.findMany({
      where: condition,
      orderBy: (r, { desc }) => [desc(r.updatedAt)],
    });

    return { rules: allRules };
  })

  /**
   * GET /api/admin/audit — Paginated audit log.
   * Filter by action, target_type, user_id.
   */
  .get("/audit", async ({ query, set, rateLimited, authorized }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    if (!authorized) {
      return { error: "Insufficient permissions" };
    }

    const q = query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (q.action) {
      conditions.push(eq(auditLogs.action, q.action));
    }
    if (q.target_type) {
      conditions.push(eq(auditLogs.targetType, q.target_type));
    }
    if (q.user_id) {
      conditions.push(eq(auditLogs.userId, q.user_id));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);

    const total = totalResult?.count ?? 0;

    const rows = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      logs: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
