import { hostname } from "node:os";
import { LIMITS } from "@fivemtotal/shared";
import { db, artifacts, artifactFiles } from "@fivemtotal/db";
import { eq } from "drizzle-orm";
import { claimJob, completeJob, failJob, reapDeadJobs } from "./claim";
import type { ClaimedJob } from "./claim";
import { runInSandbox } from "./sandbox";
import { computeVerdict } from "./verdict";
import type { Finding, InventoryFile } from "./types";

/**
 * Worker configuration.
 */
const CONCURRENCY = parseInt(process.env.SCANNER_CONCURRENCY ?? "2", 10);
const POLL_INTERVAL_MS = 1000;
const REAPER_INTERVAL_MS = 60_000;
const WORKER_ID = `${hostname()}:${process.pid}`;

/**
 * Track active jobs for concurrency control.
 */
let activeJobs = 0;
let shuttingDown = false;

/**
 * Main worker loop.
 */
async function main(): Promise<void> {
  console.log(`[scanner] Worker ${WORKER_ID} starting with concurrency=${CONCURRENCY}`);

  // Start the dead job reaper on a separate interval
  const reaperInterval = setInterval(async () => {
    try {
      const reaped = await reapDeadJobs(LIMITS.DEAD_JOB_REAPER_S);
      if (reaped > 0) {
        console.log(`[scanner] Reaped ${reaped} dead jobs`);
      }
    } catch (err) {
      console.error("[scanner] Reaper error:", err);
    }
  }, REAPER_INTERVAL_MS);

  // Handle graceful shutdown
  const shutdown = () => {
    console.log(`[scanner] Worker ${WORKER_ID} shutting down...`);
    shuttingDown = true;
    clearInterval(reaperInterval);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Main polling loop
  while (!shuttingDown) {
    // Check if under concurrency limit
    if (activeJobs >= CONCURRENCY) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    try {
      // Try to claim a job
      const job = await claimJob(WORKER_ID);

      if (job) {
        // Spawn processJob concurrently (don't await)
        activeJobs++;
        processJob(job).finally(() => {
          activeJobs--;
        });
      } else {
        // No jobs available, sleep before next poll
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      console.error("[scanner] Poll error:", err);
      await sleep(POLL_INTERVAL_MS);
    }
  }

  // Wait for active jobs to complete before exiting
  console.log(`[scanner] Waiting for ${activeJobs} active jobs to complete...`);
  while (activeJobs > 0) {
    await sleep(500);
  }

  console.log(`[scanner] Worker ${WORKER_ID} stopped`);
}

/**
 * Process a single scan job.
 *
 * 1. Fetch artifact info
 * 2. Run sandbox analysis
 * 3. Insert artifact files
 * 4. Compute verdict
 * 5. Mark job complete or failed
 */
async function processJob(job: ClaimedJob): Promise<void> {
  const jobId = job.id;
  console.log(`[scanner] Processing job ${jobId} for artifact ${job.artifact_id}`);

  try {
    // Fetch artifact info
    const [artifact] = await db
      .select()
      .from(artifacts)
      .where(eq(artifacts.id, job.artifact_id))
      .limit(1);

    if (!artifact) {
      await failJob(jobId, "Artifact not found");
      return;
    }

    // Run the analysis pipeline in a sandboxed subprocess
    const result = await runInSandbox(artifact.storagePath, jobId);

    if (!result.success) {
      await failJob(jobId, result.error ?? "Sandbox execution failed");
      return;
    }

    const data = result.data as {
      scanJobId: string;
      inventory: {
        files: InventoryFile[];
        manifest: unknown;
      };
      findings: Finding[];
    };

    // Insert artifact files into database
    const artifactFileIdMap = new Map<string, string>();
    if (data.inventory.files.length > 0) {
      for (const file of data.inventory.files) {
        const [inserted] = await db
          .insert(artifactFiles)
          .values({
            artifactId: artifact.id,
            filePath: file.path,
            sha256Raw: file.sha256,
            fileSize: file.size,
            fileType: file.type,
          })
          .returning({ id: artifactFiles.id });

        artifactFileIdMap.set(file.sha256, inserted.id);
      }
    }

    // Map artifact file IDs in findings
    const mappedFindings = data.findings.map((f) => ({
      ...f,
      artifactFileId: artifactFileIdMap.get(f.artifactFileId) ?? f.artifactFileId,
    }));

    // If no artifact files were created, create a placeholder
    if (artifactFileIdMap.size === 0) {
      const [placeholder] = await db
        .insert(artifactFiles)
        .values({
          artifactId: artifact.id,
          filePath: artifact.originalFilename,
          sha256Raw: artifact.sha256,
          fileSize: artifact.fileSize,
          fileType: "other",
        })
        .returning({ id: artifactFiles.id });

      // Update all findings to use the placeholder
      for (const f of mappedFindings) {
        f.artifactFileId = placeholder.id;
      }
    }

    // Compute verdict
    const fileSha256s = data.inventory.files.map((f) => f.sha256);
    const verdict = await computeVerdict(
      jobId,
      artifact.id,
      mappedFindings,
      {
        fileSha256s,
        archiveSha256: artifact.sha256,
      },
    );

    console.log(
      `[scanner] Job ${jobId} verdict: ${verdict.status} (${verdict.severity}, ${verdict.confidence}% confidence)`,
    );

    // Mark job complete
    await completeJob(jobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scanner] Job ${jobId} failed:`, message);
    await failJob(jobId, message).catch((e) =>
      console.error("[scanner] Failed to mark job as failed:", e),
    );
  }
}

/**
 * Sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start the worker
main().catch((err) => {
  console.error("[scanner] Fatal error:", err);
  process.exit(1);
});
