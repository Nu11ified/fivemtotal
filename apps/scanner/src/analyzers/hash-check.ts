import { db, hashReputation } from "@fivemtotal/db";
import { eq, and, inArray } from "drizzle-orm";
import type { InventoryFile, Finding } from "../types";

/**
 * Phase 2: Hash check.
 *
 * 1. Collect all file SHA-256s from Phase 1
 * 2. Batch query hash_reputation WHERE hash_type = 'file'
 * 3. For each match on blacklist -> create Critical finding
 * 4. For warning -> create Medium finding
 * 5. Return findings array
 */
export async function checkHashes(
  files: InventoryFile[],
  scanJobId: string,
): Promise<Finding[]> {
  if (files.length === 0) return [];

  const findings: Finding[] = [];
  const sha256List = files.map((f) => f.sha256);

  // Batch query - process in chunks of 500 to avoid query size limits
  const chunkSize = 500;
  const reputations: Array<{
    sha256: string;
    list: string;
    malwareFamilyId: string | null;
    source: string;
    analystNote: string | null;
  }> = [];

  for (let i = 0; i < sha256List.length; i += chunkSize) {
    const chunk = sha256List.slice(i, i + chunkSize);
    const rows = await db
      .select({
        sha256: hashReputation.sha256,
        list: hashReputation.list,
        malwareFamilyId: hashReputation.malwareFamilyId,
        source: hashReputation.source,
        analystNote: hashReputation.analystNote,
      })
      .from(hashReputation)
      .where(
        and(
          inArray(hashReputation.sha256, chunk),
          eq(hashReputation.hashType, "file"),
        ),
      );
    reputations.push(...rows);
  }

  // Build a lookup map: sha256 -> reputation entry
  const reputationMap = new Map(reputations.map((r) => [r.sha256, r]));

  // Generate findings for matching hashes
  for (const file of files) {
    const rep = reputationMap.get(file.sha256);
    if (!rep) continue;

    if (rep.list === "blacklist") {
      findings.push({
        scanJobId,
        artifactFileId: file.artifactFileId ?? file.sha256,
        category: "ioc_match",
        severity: "critical",
        confidence: 95,
        title: `Known malicious file hash: ${file.path}`,
        evidenceSnippet: `SHA-256: ${file.sha256}`,
        decodedContent: rep.analystNote ?? undefined,
      });
    } else if (rep.list === "warning") {
      findings.push({
        scanJobId,
        artifactFileId: file.artifactFileId ?? file.sha256,
        category: "ioc_match",
        severity: "medium",
        confidence: 70,
        title: `Warning-listed file hash: ${file.path}`,
        evidenceSnippet: `SHA-256: ${file.sha256}`,
        decodedContent: rep.analystNote ?? undefined,
      });
    }
  }

  return findings;
}
