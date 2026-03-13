import { db } from "@fivemtotal/db";
import { sql } from "drizzle-orm";

/**
 * Claimed scan job row returned from the database.
 * Uses index signature to satisfy drizzle's Record<string, unknown> constraint.
 */
export interface ClaimedJob {
  [key: string]: unknown;
  id: string;
  artifact_id: string;
  user_id: string | null;
  status: string;
  priority: number;
  worker_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Atomically claim the next queued scan job using FOR UPDATE SKIP LOCKED.
 * Returns the claimed job row, or null if no jobs are available.
 */
export async function claimJob(workerId: string): Promise<ClaimedJob | null> {
  const result = await db.execute(sql`
    UPDATE scan_jobs
    SET status = 'processing',
        worker_id = ${workerId},
        started_at = now(),
        updated_at = now()
    WHERE id = (
      SELECT id FROM scan_jobs
      WHERE status = 'queued'
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);

  const rows = result as unknown as ClaimedJob[];
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0];
}

/**
 * Mark a scan job as completed.
 */
export async function completeJob(jobId: string): Promise<void> {
  await db.execute(sql`
    UPDATE scan_jobs
    SET status = 'completed',
        completed_at = now(),
        updated_at = now()
    WHERE id = ${jobId}
  `);
}

/**
 * Mark a scan job as failed with an error message.
 */
export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await db.execute(sql`
    UPDATE scan_jobs
    SET status = 'failed',
        error_message = ${errorMessage},
        completed_at = now(),
        updated_at = now()
    WHERE id = ${jobId}
  `);
}

/**
 * Reap dead/stuck jobs: mark processing jobs older than the timeout as timed_out.
 */
export async function reapDeadJobs(timeoutSeconds: number): Promise<number> {
  const result = await db.execute(sql`
    UPDATE scan_jobs
    SET status = 'timed_out',
        error_message = 'Job exceeded processing timeout',
        completed_at = now(),
        updated_at = now()
    WHERE status = 'processing'
      AND started_at < now() - make_interval(secs => ${timeoutSeconds})
    RETURNING id
  `);

  const rows = result as unknown as Array<{ id: string }>;
  return rows?.length ?? 0;
}
