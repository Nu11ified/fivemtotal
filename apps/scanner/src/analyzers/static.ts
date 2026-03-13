import { readFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { tokenizeLua, extractFunctionCalls, extractStringLiterals } from "./lua-tokenizer";
import type { Inventory, InventoryFile, Finding, DetectedSink } from "../types";

/**
 * Dangerous sink patterns and their categories.
 */
const DANGEROUS_SINKS: Array<{
  pattern: string | RegExp;
  name: string;
  category: string;
  description: string;
}> = [
  {
    pattern: "PerformHttpRequest",
    name: "PerformHttpRequest",
    category: "remote_fetch",
    description: "Remote HTTP fetch",
  },
  {
    pattern: /^load$/,
    name: "load",
    category: "dynamic_exec",
    description: "Dynamic code execution via load()",
  },
  {
    pattern: "loadstring",
    name: "loadstring",
    category: "dynamic_exec",
    description: "Dynamic code execution via loadstring()",
  },
  {
    pattern: "SaveResourceFile",
    name: "SaveResourceFile",
    category: "cross_resource_io",
    description: "Cross-resource file write",
  },
  {
    pattern: "LoadResourceFile",
    name: "LoadResourceFile",
    category: "cross_resource_io",
    description: "Cross-resource file read",
  },
  {
    pattern: "os.execute",
    name: "os.execute",
    category: "host_escape",
    description: "Host command execution",
  },
  {
    pattern: "os.getenv",
    name: "os.getenv",
    category: "host_escape",
    description: "Environment variable access",
  },
  {
    pattern: "io.popen",
    name: "io.popen",
    category: "host_escape",
    description: "Host command execution via pipe",
  },
  {
    pattern: "GetConvar",
    name: "GetConvar",
    category: "config_access",
    description: "Server configuration access",
  },
];

/**
 * Phase 3: Static analysis.
 *
 * Analyzes Lua and JS files for dangerous patterns, source-sink pairings,
 * and manifest discrepancies.
 */
export async function analyzeStatic(
  inventory: Inventory,
  scratchDir: string,
  scanJobId: string,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Analyze each Lua and JS file
  for (const file of inventory.files) {
    if (file.type !== "lua" && file.type !== "js") continue;

    const filePath = join(scratchDir, "extracted", file.path);
    let content: string;

    try {
      content = await readFile(filePath, "utf-8");
    } catch {
      continue; // File may not be readable
    }

    const fileFindings = analyzeFile(content, file, scanJobId);
    findings.push(...fileFindings);
  }

  // Manifest analysis
  if (inventory.manifest) {
    const manifestFindings = analyzeManifest(inventory, scanJobId);
    findings.push(...manifestFindings);
  }

  return findings;
}

/**
 * Analyze a single source file for dangerous patterns and source-sink pairings.
 */
function analyzeFile(
  content: string,
  file: InventoryFile,
  scanJobId: string,
): Finding[] {
  const findings: Finding[] = [];
  const artifactFileId = file.artifactFileId ?? file.sha256;

  // Tokenize (only Lua for now; JS gets regex-based analysis)
  const isLua = file.type === "lua";
  const sinks = isLua ? detectSinksFromTokens(content) : detectSinksFromRegex(content);

  // Categorize sinks present in this file
  const sinkCategories = new Set(sinks.map((s) => s.category));

  // Source-sink pairing detection

  // HTTP fetch + dynamic exec in same file = loader (Critical)
  if (sinkCategories.has("remote_fetch") && sinkCategories.has("dynamic_exec")) {
    const fetchSink = sinks.find((s) => s.category === "remote_fetch")!;
    const execSink = sinks.find((s) => s.category === "dynamic_exec")!;
    findings.push({
      scanJobId,
      artifactFileId,
      category: "loader",
      severity: "critical",
      confidence: 90,
      title: `Remote code loader detected in ${file.path}`,
      evidenceSnippet: `Fetch at line ${fetchSink.line}, exec at line ${execSink.line}: ${fetchSink.snippet} -> ${execSink.snippet}`,
      lineNumber: fetchSink.line,
    });
  }

  // GetConvar + HTTP send in same file = exfil (Critical)
  if (sinkCategories.has("config_access") && sinkCategories.has("remote_fetch")) {
    const configSink = sinks.find((s) => s.category === "config_access")!;
    const fetchSink = sinks.find((s) => s.category === "remote_fetch")!;
    findings.push({
      scanJobId,
      artifactFileId,
      category: "exfil",
      severity: "critical",
      confidence: 85,
      title: `Config exfiltration pattern in ${file.path}`,
      evidenceSnippet: `Config read at line ${configSink.line}, HTTP send at line ${fetchSink.line}`,
      lineNumber: configSink.line,
    });
  }

  // File read + file write to other resource path = propagation (Critical)
  if (sinkCategories.has("cross_resource_io")) {
    const ioSinks = sinks.filter((s) => s.category === "cross_resource_io");
    const hasRead = ioSinks.some((s) => s.name === "LoadResourceFile");
    const hasWrite = ioSinks.some((s) => s.name === "SaveResourceFile");
    if (hasRead && hasWrite) {
      findings.push({
        scanJobId,
        artifactFileId,
        category: "propagator",
        severity: "critical",
        confidence: 85,
        title: `Cross-resource propagation pattern in ${file.path}`,
        evidenceSnippet: ioSinks.map((s) => `${s.name} at line ${s.line}`).join(", "),
        lineNumber: ioSinks[0].line,
      });
    }
  }

  // os.execute / io.popen standalone = host_abuse (Critical)
  const hostEscapeSinks = sinks.filter(
    (s) => s.category === "host_escape" && (s.name === "os.execute" || s.name === "io.popen"),
  );
  for (const sink of hostEscapeSinks) {
    findings.push({
      scanJobId,
      artifactFileId,
      category: "host_abuse",
      severity: "critical",
      confidence: 90,
      title: `Host command execution via ${sink.name} in ${file.path}`,
      evidenceSnippet: sink.snippet,
      lineNumber: sink.line,
    });
  }

  // Remote fetch without dynamic exec = High
  if (sinkCategories.has("remote_fetch") && !sinkCategories.has("dynamic_exec")) {
    const fetchSink = sinks.find((s) => s.category === "remote_fetch")!;
    findings.push({
      scanJobId,
      artifactFileId,
      category: "loader",
      severity: "high",
      confidence: 60,
      title: `Remote HTTP request in ${file.path}`,
      evidenceSnippet: fetchSink.snippet,
      lineNumber: fetchSink.line,
    });
  }

  // Heavy obfuscation detection around sink patterns = High
  const obfuscationScore = detectObfuscation(content);
  if (obfuscationScore > 0.6 && sinks.length > 0) {
    findings.push({
      scanJobId,
      artifactFileId,
      category: "obfuscation",
      severity: "high",
      confidence: Math.round(obfuscationScore * 100),
      title: `Obfuscated code with dangerous patterns in ${file.path}`,
      evidenceSnippet: `Obfuscation score: ${(obfuscationScore * 100).toFixed(1)}%, sinks: ${sinks.map((s) => s.name).join(", ")}`,
    });
  }

  // Extract URLs and domains from strings
  const urls = extractUrlsFromContent(content);
  if (urls.length > 0) {
    // Attach to first finding or create info finding
    for (const f of findings) {
      f.extractedUrls = urls.map((u) => u.url);
      f.extractedDomains = [...new Set(urls.map((u) => u.domain).filter(Boolean))] as string[];
    }
  }

  return findings;
}

/**
 * Detect dangerous sinks using the Lua tokenizer.
 */
function detectSinksFromTokens(content: string): DetectedSink[] {
  const sinks: DetectedSink[] = [];
  const tokens = tokenizeLua(content);
  const calls = extractFunctionCalls(tokens);

  for (const call of calls) {
    for (const sink of DANGEROUS_SINKS) {
      const matches =
        typeof sink.pattern === "string"
          ? call.name === sink.pattern || call.name.endsWith("." + sink.pattern)
          : sink.pattern.test(call.name);

      if (matches) {
        // Check for assert(load(...)) pattern
        const isAssertLoad =
          call.name === "assert" &&
          call.argTokens.some(
            (t) => t.type === "identifier" && (t.value === "load" || t.value === "loadstring"),
          );

        const snippetLine = getLineContent(content, call.line);
        sinks.push({
          name: isAssertLoad ? "assert(load(...))" : sink.name,
          category: isAssertLoad ? "dynamic_exec" : sink.category,
          line: call.line,
          snippet: snippetLine.slice(0, 200),
        });
      }
    }

    // Special case: assert(load(...)) where assert is the outer call
    if (call.name === "assert") {
      const hasLoadArg = call.argTokens.some(
        (t) => t.type === "identifier" && (t.value === "load" || t.value === "loadstring"),
      );
      if (hasLoadArg) {
        const snippetLine = getLineContent(content, call.line);
        sinks.push({
          name: "assert(load(...))",
          category: "dynamic_exec",
          line: call.line,
          snippet: snippetLine.slice(0, 200),
        });
      }
    }
  }

  return sinks;
}

/**
 * Detect dangerous sinks using regex for JS files.
 */
function detectSinksFromRegex(content: string): DetectedSink[] {
  const sinks: DetectedSink[] = [];
  const lines = content.split("\n");

  const patterns: Array<{
    regex: RegExp;
    name: string;
    category: string;
  }> = [
    { regex: /\beval\s*\(/, name: "eval", category: "dynamic_exec" },
    { regex: /\bFunction\s*\(/, name: "Function()", category: "dynamic_exec" },
    { regex: /\bfetch\s*\(/, name: "fetch", category: "remote_fetch" },
    { regex: /\brequire\s*\(\s*['"]child_process['"]/, name: "child_process", category: "host_escape" },
    { regex: /\bexec\s*\(/, name: "exec", category: "host_escape" },
    { regex: /\bspawn\s*\(/, name: "spawn", category: "host_escape" },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        sinks.push({
          name: pattern.name,
          category: pattern.category,
          line: i + 1,
          snippet: line.trim().slice(0, 200),
        });
      }
    }
  }

  return sinks;
}

/**
 * Detect obfuscation level of source code.
 * Returns a score from 0 (clean) to 1 (heavily obfuscated).
 */
function detectObfuscation(content: string): number {
  let score = 0;
  const len = content.length;
  if (len === 0) return 0;

  // Hex escape density: \xNN patterns
  const hexEscapes = (content.match(/\\x[0-9a-fA-F]{2}/g) || []).length;
  if (hexEscapes > 10) score += Math.min(0.3, (hexEscapes / len) * 50);

  // string.char calls
  const stringCharCalls = (content.match(/string\.char\s*\(/g) || []).length;
  if (stringCharCalls > 3) score += Math.min(0.2, stringCharCalls * 0.02);

  // Hex array tables: {0x48, 0x65, ...}
  const hexArrays = (content.match(/\{(?:\s*0x[0-9a-fA-F]+\s*,?\s*){4,}\}/g) || []).length;
  if (hexArrays > 0) score += Math.min(0.2, hexArrays * 0.1);

  // Long concatenation chains: "a" .. "b" .. "c"
  const concatChains = (content.match(/['"][^'"]*['"]\s*\.\.\s*['"][^'"]*['"]/g) || []).length;
  if (concatChains > 5) score += Math.min(0.15, concatChains * 0.01);

  // Base64-like long strings
  const base64Strings = (content.match(/['"][A-Za-z0-9+/]{50,}={0,2}['"]/g) || []).length;
  if (base64Strings > 0) score += Math.min(0.15, base64Strings * 0.05);

  // Very long lines (minified code)
  const lines = content.split("\n");
  const longLines = lines.filter((l) => l.length > 500).length;
  if (longLines > 0) score += Math.min(0.1, longLines * 0.02);

  // Low ratio of identifiers to total characters (meaningless variable names)
  const identifiers = content.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
  const shortIdentifiers = identifiers.filter(
    (id) => id.length <= 2 && !["if", "or", "do", "in", "io", "os"].includes(id),
  ).length;
  if (identifiers.length > 0) {
    const shortRatio = shortIdentifiers / identifiers.length;
    if (shortRatio > 0.3) score += Math.min(0.1, shortRatio * 0.2);
  }

  return Math.min(1, score);
}

/**
 * Extract URLs from content using regex.
 */
function extractUrlsFromContent(
  content: string,
): Array<{ url: string; domain: string | null }> {
  const urlRegex = /https?:\/\/[^\s'"<>\]\)}{,]+/gi;
  const matches = content.match(urlRegex) || [];

  return matches.map((url) => {
    let domain: string | null = null;
    try {
      domain = new URL(url).hostname;
    } catch {
      // Invalid URL
    }
    return { url, domain };
  });
}

/**
 * Analyze manifest for discrepancies.
 */
function analyzeManifest(
  inventory: Inventory,
  scanJobId: string,
): Finding[] {
  const findings: Finding[] = [];
  const manifest = inventory.manifest!;

  // Get the manifest file for artifactFileId
  const manifestFile = inventory.files.find(
    (f) =>
      f.type === "manifest" &&
      (basename(f.path).toLowerCase() === "fxmanifest.lua" ||
        basename(f.path).toLowerCase() === "__resource.lua"),
  );

  const manifestArtifactId = manifestFile?.artifactFileId ?? manifestFile?.sha256 ?? "unknown";

  // Get directory of manifest to resolve relative paths
  const manifestDir = manifestFile ? dirname(manifestFile.path) : "";

  // All actual file paths (relative to resource root)
  const actualFiles = new Set(inventory.files.map((f) => f.path));

  // Normalize paths for comparison
  const normalizeForComparison = (p: string): string => {
    if (manifestDir && manifestDir !== ".") {
      return join(manifestDir, p);
    }
    return p;
  };

  // Check for undeclared files (in directory but not in manifest)
  for (const file of inventory.files) {
    if (file.type === "manifest") continue;
    if (file.type === "binary" || file.type === "other") continue;

    // Check if this file is referenced in the manifest
    const relToManifest = manifestDir && manifestDir !== "."
      ? file.path.replace(manifestDir + "/", "")
      : file.path;

    const isDeclared = manifest.allDeclared.some((declared) => {
      // Handle glob patterns like *.lua
      if (declared.includes("*")) {
        const regex = new RegExp(
          "^" + declared.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
        );
        return regex.test(relToManifest) || regex.test(basename(file.path));
      }
      return declared === relToManifest || declared === basename(file.path);
    });

    if (!isDeclared) {
      findings.push({
        scanJobId,
        artifactFileId: file.artifactFileId ?? file.sha256,
        category: "obfuscation",
        severity: "medium",
        confidence: 60,
        title: `Undeclared file: ${file.path}`,
        evidenceSnippet: `File exists in resource but is not referenced in manifest`,
      });
    }
  }

  // Check for missing files (in manifest but not in directory)
  for (const declared of manifest.allDeclared) {
    if (declared.includes("*")) continue; // Skip glob patterns

    const resolvedPath = normalizeForComparison(declared);
    if (!actualFiles.has(resolvedPath) && !actualFiles.has(declared)) {
      findings.push({
        scanJobId,
        artifactFileId: manifestArtifactId,
        category: "obfuscation",
        severity: "low",
        confidence: 70,
        title: `Missing declared file: ${declared}`,
        evidenceSnippet: `File referenced in manifest but not found in resource`,
      });
    }
  }

  // Check for suspicious entries (loading from other resource paths)
  for (const declared of manifest.allDeclared) {
    if (declared.startsWith("@") || declared.includes("../") || declared.includes("..\\")) {
      findings.push({
        scanJobId,
        artifactFileId: manifestArtifactId,
        category: "propagator",
        severity: "high",
        confidence: 75,
        title: `Suspicious manifest entry: ${declared}`,
        evidenceSnippet: `Manifest references file from another resource or parent directory`,
      });
    }
  }

  return findings;
}

/**
 * Get a specific line from content by line number.
 */
function getLineContent(content: string, lineNumber: number): string {
  const lines = content.split("\n");
  if (lineNumber < 1 || lineNumber > lines.length) return "";
  return lines[lineNumber - 1].trim();
}
