import { Elysia } from "elysia";
import { eq, and, count } from "drizzle-orm";
import {
  db,
  hashReputation,
  malwareFamilies,
  iocIndicators,
} from "@fivemtotal/db";
import { paginationSchema } from "@fivemtotal/shared";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";

export const reputationRoutes = new Elysia({ prefix: "/api" })
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  /**
   * GET /api/reputation/:sha256 — Public, rate-limited by IP.
   * Look up hash reputation by SHA-256.
   */
  .get("/reputation/:sha256", async ({ params, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    // Validate sha256 format
    if (!/^[a-f0-9]{64}$/.test(params.sha256)) {
      set.status = 400;
      return { error: "Invalid SHA-256 hash format" };
    }

    const entry = await db.query.hashReputation.findFirst({
      where: eq(hashReputation.sha256, params.sha256),
    });

    if (!entry) {
      set.status = 404;
      return { error: "Hash not found in reputation database" };
    }

    return {
      sha256: entry.sha256,
      hashType: entry.hashType,
      list: entry.list,
      malwareFamilyId: entry.malwareFamilyId,
      source: entry.source,
      analystNote: entry.analystNote,
    };
  })

  /**
   * GET /api/families — Public. List all malware families.
   */
  .get("/families", async ({ set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    const families = await db.query.malwareFamilies.findMany({
      orderBy: (f, { asc }) => [asc(f.name)],
    });

    return { families };
  })

  /**
   * GET /api/iocs — Paginated IOC indicator feed.
   * Query params: page, limit, type (optional filter).
   */
  .get("/iocs", async ({ query, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    const parsed = paginationSchema.safeParse(query);
    const page = parsed.success ? parsed.data.page : 1;
    const limit = parsed.success ? parsed.data.limit : 20;
    const offset = (page - 1) * limit;

    // Optional type filter from query
    const typeFilter = (query as Record<string, string>).type;
    const validTypes = ["domain", "url", "url_pattern", "hash", "regex"];

    const conditions = [];
    if (typeFilter && validTypes.includes(typeFilter)) {
      conditions.push(
        eq(iocIndicators.type, typeFilter as "domain" | "url" | "url_pattern" | "hash" | "regex")
      );
    }

    // Count total
    const [totalResult] = await db
      .select({ count: count() })
      .from(iocIndicators)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalResult?.count ?? 0;

    // Fetch paginated indicators
    const rows = await db
      .select()
      .from(iocIndicators)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(iocIndicators.createdAt)
      .limit(limit)
      .offset(offset);

    return {
      indicators: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
