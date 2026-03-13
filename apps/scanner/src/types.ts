import type { FindingCategory, Severity, FileType } from "@fivemtotal/shared";

/**
 * Represents a single file extracted from an archive during the unpack phase.
 */
export interface InventoryFile {
  /** Relative path within the extracted archive */
  path: string;
  /** SHA-256 hash of the file content */
  sha256: string;
  /** File size in bytes */
  size: number;
  /** Classified file type */
  type: FileType;
  /** Database artifact_file ID (set after DB insert) */
  artifactFileId?: string;
}

/**
 * Parsed fxmanifest.lua / __resource.lua manifest.
 */
export interface ParsedManifest {
  /** Files declared as client_scripts */
  clientScripts: string[];
  /** Files declared as server_scripts */
  serverScripts: string[];
  /** Files declared as shared_scripts */
  sharedScripts: string[];
  /** Files declared as files (downloadable assets) */
  files: string[];
  /** fx_version if declared */
  fxVersion?: string;
  /** game if declared */
  game?: string;
  /** All declared file references (union of all above) */
  allDeclared: string[];
}

/**
 * Result of the unpack/inventory phase (Phase 1).
 */
export interface Inventory {
  files: InventoryFile[];
  manifest?: ParsedManifest;
}

/**
 * A single analysis finding produced by any pipeline phase.
 */
export interface Finding {
  scanJobId: string;
  artifactFileId: string;
  ruleId?: string | null;
  category: FindingCategory;
  severity: Severity;
  confidence: number;
  title: string;
  evidenceSnippet?: string;
  decodedContent?: string;
  extractedUrls?: string[];
  extractedDomains?: string[];
  lineNumber?: number;
}

/**
 * Result from the deobfuscation pipeline (Phase 4).
 */
export interface DeobfuscationResult {
  findings: Finding[];
  /** Normalized file inventory for re-analysis */
  normalizedFiles: InventoryFile[];
}

/**
 * Token types for the lightweight Lua tokenizer.
 */
export type LuaTokenType =
  | "identifier"
  | "string"
  | "number"
  | "keyword"
  | "operator"
  | "punctuation"
  | "comment"
  | "whitespace"
  | "unknown";

/**
 * A single token from the Lua tokenizer.
 */
export interface LuaToken {
  type: LuaTokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Result of static analysis for a single file.
 */
export interface StaticAnalysisResult {
  sinks: DetectedSink[];
  findings: Finding[];
}

/**
 * A detected dangerous function call/pattern.
 */
export interface DetectedSink {
  name: string;
  category: string;
  line: number;
  snippet: string;
}

/**
 * Rule pattern types from the rules table.
 */
export interface RegexRulePattern {
  type: "regex";
  pattern: string;
  flags?: string;
}

export interface BehaviorRulePattern {
  type: "behavior";
  sinks: string[];
}

export interface AstRulePattern {
  type: "ast";
  [key: string]: unknown;
}

export type RulePattern = RegexRulePattern | BehaviorRulePattern | AstRulePattern;
