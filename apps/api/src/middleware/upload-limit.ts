import { LIMITS } from "@fivemtotal/shared";
import type { Tier } from "@fivemtotal/shared";

/**
 * In-memory concurrent upload tracker.
 * Tracks how many uploads are currently in-flight per user (or "anon" for unauthenticated).
 * Single-process constraint for v1 -- not Redis-backed.
 */
const activeUploads = new Map<string, number>();

/**
 * Check whether the user is within their concurrent upload limit.
 * Returns true if a new upload is allowed, false if at capacity.
 */
export function checkConcurrentUploads(
  userId: string | null,
  tier: Tier
): boolean {
  const key = userId ?? "anon";
  const current = activeUploads.get(key) ?? 0;
  const limit =
    tier === "paid"
      ? LIMITS.PAID_CONCURRENT_UPLOADS
      : LIMITS.FREE_CONCURRENT_UPLOADS;
  return current < limit;
}

/**
 * Increment the in-flight upload counter for a user.
 * Call at the start of upload processing.
 */
export function incrementUploads(userId: string | null): void {
  const key = userId ?? "anon";
  activeUploads.set(key, (activeUploads.get(key) ?? 0) + 1);
}

/**
 * Decrement the in-flight upload counter for a user.
 * Call in a finally block after upload processing completes (success or failure).
 */
export function decrementUploads(userId: string | null): void {
  const key = userId ?? "anon";
  const current = activeUploads.get(key) ?? 0;
  if (current > 0) {
    activeUploads.set(key, current - 1);
  }
}
