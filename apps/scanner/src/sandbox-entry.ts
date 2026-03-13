/**
 * Sandbox entry point — runs inside the sandboxed subprocess.
 *
 * Orchestrates all 6 pipeline phases:
 *   1. Unpack and inventory
 *   2. Hash check
 *   3. Static analysis
 *   4. Deobfuscation + re-analysis
 *   5. IOC matching
 *   6. Rule engine
 *
 * Reads artifact from a path argument, runs all phases,
 * writes JSON result to stdout.
 */

import { unpack } from "./analyzers/unpack";
import { checkHashes } from "./analyzers/hash-check";
import { analyzeStatic } from "./analyzers/static";
import { deobfuscate } from "./deobfuscators/index";
import { matchIOCs } from "./matchers/ioc";
import { matchRules } from "./matchers/rules";
import type { Finding } from "./types";

const [artifactPath, scratchDir, scanJobId] = process.argv.slice(2);

if (!artifactPath || !scratchDir || !scanJobId) {
  console.error("Usage: sandbox-entry.ts <artifactPath> <scratchDir> <scanJobId>");
  process.exit(1);
}

async function run(): Promise<void> {
  const allFindings: Finding[] = [];

  // Phase 1: Unpack and inventory
  const inventory = await unpack(artifactPath, scratchDir);

  // Phase 2: Hash check
  const hashFindings = await checkHashes(inventory.files, scanJobId);
  allFindings.push(...hashFindings);

  // Phase 3: Static analysis
  const staticFindings = await analyzeStatic(inventory, scratchDir, scanJobId);
  allFindings.push(...staticFindings);

  // Phase 4: Deobfuscation + re-analysis on normalized output
  const deobfuscationResult = await deobfuscate(inventory, scratchDir, scanJobId);
  allFindings.push(...deobfuscationResult.findings);

  // Re-run static analysis on deobfuscated/normalized sources
  if (deobfuscationResult.normalizedFiles.length > 0) {
    const reanalysisFindings = await analyzeStatic(
      {
        ...inventory,
        files: deobfuscationResult.normalizedFiles,
      },
      scratchDir,
      scanJobId,
    );
    // Tag re-analysis findings to distinguish them
    for (const f of reanalysisFindings) {
      f.title = `[Deobfuscated] ${f.title}`;
    }
    allFindings.push(...reanalysisFindings);
  }

  // Phase 5: IOC matching
  const iocFindings = await matchIOCs(allFindings, inventory, scanJobId);
  allFindings.push(...iocFindings);

  // Phase 6: Rule engine
  const ruleFindings = await matchRules(inventory, allFindings, scratchDir, scanJobId);
  allFindings.push(...ruleFindings);

  // Output results as JSON to stdout
  const result = {
    scanJobId,
    inventory: {
      files: inventory.files,
      manifest: inventory.manifest ?? null,
    },
    findings: allFindings,
  };

  console.log(JSON.stringify(result));
}

run().catch((err) => {
  console.error(`Sandbox fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
