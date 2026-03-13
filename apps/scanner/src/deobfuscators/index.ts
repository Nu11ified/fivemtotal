import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { deobfuscateHexArrays } from "./hex-array";
import { decodeEscapeSequences } from "./escape-decode";
import { deobfuscateStringChar } from "./string-char";
import { foldConcatenation } from "./concat-fold";
import { decodeBase64Strings } from "./base64";
import { extractUrls, extractDomains } from "./url-extract";
import type { Inventory, InventoryFile, Finding, DeobfuscationResult } from "../types";

/**
 * Phase 4: Deobfuscation pipeline.
 *
 * Runs all deobfuscators in sequence on each Lua/JS file,
 * produces normalized source, and extracts URLs/domains.
 * Returns findings for obfuscation detection and normalized files
 * for re-analysis by Phase 3.
 */
export async function deobfuscate(
  inventory: Inventory,
  scratchDir: string,
  scanJobId: string,
): Promise<DeobfuscationResult> {
  const findings: Finding[] = [];
  const normalizedFiles: InventoryFile[] = [];
  const normalizedDir = join(scratchDir, "normalized");

  // Create normalized output directory
  await Bun.write(join(normalizedDir, ".keep"), "");

  for (const file of inventory.files) {
    if (file.type !== "lua" && file.type !== "js") continue;

    const filePath = join(scratchDir, "extracted", file.path);
    let content: string;

    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    // Run deobfuscation pipeline in sequence
    let normalized = content;
    let wasModified = false;

    // Step 1: Hex array reconstruction
    const afterHexArray = deobfuscateHexArrays(normalized);
    if (afterHexArray !== normalized) {
      normalized = afterHexArray;
      wasModified = true;
    }

    // Step 2: Escape sequence decoding
    const afterEscape = decodeEscapeSequences(normalized);
    if (afterEscape !== normalized) {
      normalized = afterEscape;
      wasModified = true;
    }

    // Step 3: string.char folding
    const afterStringChar = deobfuscateStringChar(normalized);
    if (afterStringChar !== normalized) {
      normalized = afterStringChar;
      wasModified = true;
    }

    // Step 4: Concatenation folding
    const afterConcat = foldConcatenation(normalized);
    if (afterConcat !== normalized) {
      normalized = afterConcat;
      wasModified = true;
    }

    // Step 5: Base64 decoding
    const afterBase64 = decodeBase64Strings(normalized);
    if (afterBase64 !== normalized) {
      normalized = afterBase64;
      wasModified = true;
    }

    // If content was modified by deobfuscation, save normalized version
    if (wasModified) {
      const normalizedPath = join(normalizedDir, file.path);

      // Ensure directory exists
      const dir = join(normalizedDir, file.path.split("/").slice(0, -1).join("/"));
      if (dir !== normalizedDir) {
        await Bun.write(join(dir, ".keep"), "");
      }

      await writeFile(normalizedPath, normalized, "utf-8");

      // Compute hash of normalized content
      const sha256 = createHash("sha256")
        .update(Buffer.from(normalized))
        .digest("hex");

      normalizedFiles.push({
        path: file.path,
        sha256,
        size: Buffer.byteLength(normalized),
        type: file.type,
        artifactFileId: file.artifactFileId,
      });

      // Create finding for obfuscation detection
      findings.push({
        scanJobId,
        artifactFileId: file.artifactFileId ?? file.sha256,
        category: "obfuscation",
        severity: "medium",
        confidence: 65,
        title: `Obfuscated content detected in ${file.path}`,
        evidenceSnippet: `File was modified by deobfuscation pipeline (original size: ${content.length}, normalized size: ${normalized.length})`,
      });

      // Step 6: Extract URLs and domains from normalized output
      const urls = extractUrls(normalized);
      const domains = extractDomains(normalized);

      if (urls.length > 0 || domains.length > 0) {
        findings.push({
          scanJobId,
          artifactFileId: file.artifactFileId ?? file.sha256,
          category: "ioc_match",
          severity: "high",
          confidence: 70,
          title: `URLs/domains found in deobfuscated content of ${file.path}`,
          extractedUrls: urls.map((u) => u.url),
          extractedDomains: domains,
          evidenceSnippet: urls
            .slice(0, 5)
            .map((u) => u.url)
            .join(", "),
        });
      }
    }
  }

  return { findings, normalizedFiles };
}
