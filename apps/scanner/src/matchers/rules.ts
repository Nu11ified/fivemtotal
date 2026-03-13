import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db, rules } from "@fivemtotal/db";
import { eq } from "drizzle-orm";
import type {
  Inventory,
  Finding,
  RulePattern,
  RegexRulePattern,
  BehaviorRulePattern,
} from "../types";
import type { FindingCategory, Severity } from "@fivemtotal/shared";

/**
 * Phase 6: Rule engine.
 *
 * 1. Load active rules from the rules table
 * 2. For each rule, match against file content and findings
 * 3. Generate findings for matches
 */
export async function matchRules(
  inventory: Inventory,
  existingFindings: Finding[],
  scratchDir: string,
  scanJobId: string,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Load active rules
  const activeRules = await db
    .select()
    .from(rules)
    .where(eq(rules.isActive, true));

  if (activeRules.length === 0) return findings;

  // Pre-load source files for regex matching
  const fileContents = new Map<string, string>();
  for (const file of inventory.files) {
    if (file.type !== "lua" && file.type !== "js") continue;

    // Try extracted directory first, then normalized
    for (const subdir of ["extracted", "normalized"]) {
      const filePath = join(scratchDir, subdir, file.path);
      try {
        const content = await readFile(filePath, "utf-8");
        const key = `${subdir}:${file.path}`;
        fileContents.set(key, content);
      } catch {
        // File may not exist in this directory
      }
    }
  }

  // Collect sink names from existing findings for behavior matching
  const detectedSinks = new Set<string>();
  const sinkPatterns = [
    "PerformHttpRequest",
    "load",
    "loadstring",
    "assert(load(...))",
    "SaveResourceFile",
    "LoadResourceFile",
    "os.getenv",
    "io.popen",
    "GetConvar",
    "fetch",
  ];
  for (const f of existingFindings) {
    for (const sink of sinkPatterns) {
      if (
        f.title.includes(sink) ||
        (f.evidenceSnippet && f.evidenceSnippet.includes(sink))
      ) {
        detectedSinks.add(sink);
      }
    }
    // Also check for host command execution patterns
    if (
      f.title.includes("os.execute") ||
      (f.evidenceSnippet && f.evidenceSnippet.includes("os.execute"))
    ) {
      detectedSinks.add("os.execute");
    }
  }

  // Process each rule
  for (const rule of activeRules) {
    const pattern = rule.pattern as RulePattern;
    if (!pattern || typeof pattern !== "object" || !("type" in pattern)) continue;

    const category = rule.category as FindingCategory;
    const severity = rule.severity as Severity;

    switch (pattern.type) {
      case "regex":
        matchRegexRule(
          pattern as RegexRulePattern,
          rule.id,
          rule.name,
          category,
          severity,
          fileContents,
          inventory,
          scanJobId,
          findings,
        );
        break;

      case "behavior":
        matchBehaviorRule(
          pattern as BehaviorRulePattern,
          rule.id,
          rule.name,
          category,
          severity,
          detectedSinks,
          inventory,
          scanJobId,
          findings,
        );
        break;

      case "ast":
        // AST rules are a placeholder for future implementation
        break;
    }
  }

  return findings;
}

/**
 * Match a regex rule against all source files (raw + normalized).
 */
function matchRegexRule(
  pattern: RegexRulePattern,
  ruleId: string,
  ruleName: string,
  category: FindingCategory,
  severity: Severity,
  fileContents: Map<string, string>,
  inventory: Inventory,
  scanJobId: string,
  findings: Finding[],
): void {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern.pattern, pattern.flags ?? "gim");
  } catch {
    return; // Invalid regex
  }

  for (const [key, content] of fileContents) {
    const filePath = key.split(":").slice(1).join(":");
    const file = inventory.files.find((f) => f.path === filePath);
    if (!file) continue;

    // Reset regex state
    regex.lastIndex = 0;
    const match = regex.exec(content);

    if (match) {
      // Find line number
      const upToMatch = content.slice(0, match.index);
      const lineNumber = (upToMatch.match(/\n/g) || []).length + 1;

      findings.push({
        scanJobId,
        artifactFileId: file.artifactFileId ?? file.sha256,
        ruleId,
        category,
        severity,
        confidence: 80,
        title: `Rule match: ${ruleName} in ${file.path}`,
        evidenceSnippet: match[0].slice(0, 300),
        lineNumber,
      });
    }
  }
}

/**
 * Match a behavior rule: check if specified sink combinations are present.
 */
function matchBehaviorRule(
  pattern: BehaviorRulePattern,
  ruleId: string,
  ruleName: string,
  category: FindingCategory,
  severity: Severity,
  detectedSinks: Set<string>,
  inventory: Inventory,
  scanJobId: string,
  findings: Finding[],
): void {
  if (!pattern.sinks || !Array.isArray(pattern.sinks)) return;

  // Check if ALL required sinks are present
  const allPresent = pattern.sinks.every((sink) => detectedSinks.has(sink));

  if (allPresent) {
    const defaultFile = inventory.files[0];
    findings.push({
      scanJobId,
      artifactFileId: defaultFile?.artifactFileId ?? defaultFile?.sha256 ?? "unknown",
      ruleId,
      category,
      severity,
      confidence: 75,
      title: `Behavior rule match: ${ruleName}`,
      evidenceSnippet: `Required sinks detected: ${pattern.sinks.join(", ")}`,
    });
  }
}
