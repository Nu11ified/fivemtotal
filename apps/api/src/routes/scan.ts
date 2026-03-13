import { Elysia, t } from "elysia";
import { eq, and, count } from "drizzle-orm";
import {
  db,
  artifacts,
  scanJobs,
  findings,
  verdicts,
  hashReputation,
} from "@fivemtotal/db";
import { LIMITS, paginationSchema } from "@fivemtotal/shared";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware, incrementDailyScanCount } from "../middleware/rate-limit";
import {
  checkConcurrentUploads,
  incrementUploads,
  decrementUploads,
} from "../middleware/upload-limit";
import { storeArtifact } from "../services/storage";

/**
 * Supported archive magic bytes for validation.
 */
const MAGIC_BYTES: { name: string; offset: number; bytes: number[] }[] = [
  { name: "zip", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  {
    name: "tar",
    offset: 257,
    bytes: [0x75, 0x73, 0x74, 0x61, 0x72], // "ustar"
  },
  { name: "7z", offset: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
  { name: "gzip", offset: 0, bytes: [0x1f, 0x8b] },
];

function validateMagicBytes(buffer: Buffer): boolean {
  for (const magic of MAGIC_BYTES) {
    if (buffer.length < magic.offset + magic.bytes.length) continue;
    const match = magic.bytes.every(
      (b, i) => buffer[magic.offset + i] === b
    );
    if (match) return true;
  }
  return false;
}

/**
 * Compute SHA-256 of a buffer using Bun.CryptoHasher.
 */
function computeSha256(data: Buffer): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(data);
  return hasher.digest("hex");
}

export const scanRoutes = new Elysia({ prefix: "/api/scan" })
  .use(authMiddleware)
  .use(rateLimitMiddleware)

  /**
   * POST /api/scan — Upload artifact, enqueue scan.
   * Auth optional for web UI (IP rate-limited). Authenticated users get higher queue depth.
   */
  .post(
    "/",
    async ({ auth, set, body, rateLimited, checkScanLimit, request, headers }) => {
      if (rateLimited) {
        set.status = 429;
        return { error: "Rate limit exceeded" };
      }

      const file = body.file;
      if (!file) {
        set.status = 400;
        return { error: "No file provided" };
      }

      // Check file size
      if (file.size > LIMITS.MAX_FILE_SIZE) {
        set.status = 400;
        return {
          error: `File size exceeds maximum of ${LIMITS.MAX_FILE_SIZE / (1024 * 1024)}MB`,
        };
      }

      // Check concurrent upload limit before processing
      const userId = auth.userId;
      if (!checkConcurrentUploads(userId, auth.tier)) {
        const limit =
          auth.tier === "paid"
            ? LIMITS.PAID_CONCURRENT_UPLOADS
            : LIMITS.FREE_CONCURRENT_UPLOADS;
        set.status = 429;
        return {
          error: `Concurrent upload limit reached (${limit}). Wait for current uploads to finish.`,
        };
      }

      // Track this upload
      incrementUploads(userId);

      try {
        // Read file into buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Validate magic bytes
        if (!validateMagicBytes(buffer)) {
          set.status = 400;
          return {
            error:
              "Unsupported file format. Accepted formats: zip, tar, 7z, gzip.",
          };
        }

        // Compute SHA-256
        const sha256 = computeSha256(buffer);

        // Check hash reputation for archive hash — if blacklisted, return immediate verdict
        const reputationEntry = await db.query.hashReputation.findFirst({
          where: and(
            eq(hashReputation.sha256, sha256),
            eq(hashReputation.hashType, "archive")
          ),
        });

        if (reputationEntry && reputationEntry.list === "blacklist") {
          set.status = 200;
          return {
            status: "blacklisted",
            sha256,
            message: "This archive is on the blacklist.",
            source: reputationEntry.source,
            analystNote: reputationEntry.analystNote,
          };
        }

        // Check for existing artifact with completed scan (dedup)
        const existingArtifact = await db.query.artifacts.findFirst({
          where: eq(artifacts.sha256, sha256),
        });

        if (existingArtifact) {
          const completedJob = await db.query.scanJobs.findFirst({
            where: and(
              eq(scanJobs.artifactId, existingArtifact.id),
              eq(scanJobs.status, "completed")
            ),
          });

          if (completedJob) {
            const existingVerdict = await db.query.verdicts.findFirst({
              where: eq(verdicts.artifactId, existingArtifact.id),
              orderBy: (v, { desc }) => [desc(v.createdAt)],
            });

            return {
              jobId: completedJob.id,
              status: "completed",
              cached: true,
              verdict: existingVerdict
                ? {
                    status: existingVerdict.status,
                    severity: existingVerdict.severity,
                    confidence: existingVerdict.confidence,
                    summary: existingVerdict.summary,
                  }
                : null,
            };
          }
        }

        // Check queue depth per user
        const maxQueueDepth =
          auth.tier === "paid"
            ? LIMITS.PAID_QUEUE_DEPTH
            : LIMITS.FREE_QUEUE_DEPTH;

        if (userId) {
          const [queueCount] = await db
            .select({ count: count() })
            .from(scanJobs)
            .where(
              and(eq(scanJobs.userId, userId), eq(scanJobs.status, "queued"))
            );

          if (queueCount && queueCount.count >= maxQueueDepth) {
            set.status = 429;
            return {
              error: `Queue depth limit reached (${maxQueueDepth}). Wait for current scans to complete.`,
            };
          }
        }

        // Check daily scan limit for API key users
        if (auth.apiKeyId) {
          const canScan = await checkScanLimit();
          if (!canScan) {
            set.status = 429;
            return {
              error: `Daily API scan limit reached (${LIMITS.FREE_API_CALLS_PER_DAY}). Upgrade to paid for unlimited scans.`,
            };
          }
        }

        // Store artifact to disk
        const storagePath = await storeArtifact(sha256, buffer);

        // Insert artifact row
        const [artifact] = await db
          .insert(artifacts)
          .values({
            userId: userId,
            originalFilename: file.name || "upload",
            sha256,
            fileSize: file.size,
            storagePath,
          })
          .returning({ id: artifacts.id });

        // Insert scan job
        const priority = auth.tier === "paid" ? 10 : 0;
        const [scanJob] = await db
          .insert(scanJobs)
          .values({
            artifactId: artifact.id,
            userId: userId,
            priority,
          })
          .returning({ id: scanJobs.id });

        // Increment daily usage for API key requests
        if (auth.apiKeyId) {
          await incrementDailyScanCount(auth.apiKeyId);
        }

        return { jobId: scanJob.id, status: "queued" };
      } finally {
        decrementUploads(userId);
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  )

  /**
   * GET /api/scan/:id — Scan job status + verdict.
   */
  .get("/:id", async ({ params, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    const job = await db.query.scanJobs.findFirst({
      where: eq(scanJobs.id, params.id),
    });

    if (!job) {
      set.status = 404;
      return { error: "Scan job not found" };
    }

    const result: Record<string, unknown> = {
      id: job.id,
      artifactId: job.artifactId,
      status: job.status,
      priority: job.priority,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
    };

    // If completed, include verdict and finding counts by severity
    if (job.status === "completed") {
      const verdict = await db.query.verdicts.findFirst({
        where: eq(verdicts.artifactId, job.artifactId),
        orderBy: (v, { desc }) => [desc(v.createdAt)],
      });

      if (verdict) {
        result.verdict = {
          status: verdict.status,
          severity: verdict.severity,
          confidence: verdict.confidence,
          summary: verdict.summary,
        };
      }

      // Finding counts by severity
      const findingCounts = await db
        .select({
          severity: findings.severity,
          count: count(),
        })
        .from(findings)
        .where(eq(findings.scanJobId, job.id))
        .groupBy(findings.severity);

      result.findingCounts = findingCounts.reduce(
        (acc, row) => {
          acc[row.severity] = row.count;
          return acc;
        },
        {} as Record<string, number>
      );
    }

    return result;
  })

  /**
   * GET /api/scan/:id/findings — Paginated findings for a scan job.
   */
  .get("/:id/findings", async ({ params, query, set, rateLimited }) => {
    if (rateLimited) {
      set.status = 429;
      return { error: "Rate limit exceeded" };
    }

    const parsed = paginationSchema.safeParse(query);
    if (!parsed.success) {
      set.status = 400;
      return {
        error: "Invalid pagination parameters",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { page, limit, severity } = parsed.data;
    const offset = (page - 1) * limit;

    // Verify the job exists
    const job = await db.query.scanJobs.findFirst({
      where: eq(scanJobs.id, params.id),
    });

    if (!job) {
      set.status = 404;
      return { error: "Scan job not found" };
    }

    // Build conditions
    const conditions = [eq(findings.scanJobId, params.id)];
    if (severity) {
      conditions.push(eq(findings.severity, severity));
    }

    // Count total
    const [totalResult] = await db
      .select({ count: count() })
      .from(findings)
      .where(and(...conditions));

    const total = totalResult?.count ?? 0;

    // Fetch paginated findings
    const rows = await db
      .select()
      .from(findings)
      .where(and(...conditions))
      .orderBy(findings.createdAt)
      .limit(limit)
      .offset(offset);

    return {
      findings: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });
