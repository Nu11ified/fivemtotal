import { readdir, readFile, stat, mkdir } from "node:fs/promises";
import { join, relative, extname, basename, normalize } from "node:path";
import { createHash } from "node:crypto";
import { LIMITS } from "@fivemtotal/shared";
import type { Inventory, InventoryFile, ParsedManifest } from "../types";

/**
 * Magic byte signatures for archive detection.
 */
const MAGIC_BYTES: Array<{ type: ArchiveType; signature: number[]; offset?: number }> = [
  { type: "zip", signature: [0x50, 0x4b, 0x03, 0x04] },
  { type: "zip", signature: [0x50, 0x4b, 0x05, 0x06] }, // Empty archive
  { type: "gzip", signature: [0x1f, 0x8b] },
  { type: "tar", signature: [0x75, 0x73, 0x74, 0x61, 0x72], offset: 257 }, // "ustar" at offset 257
  { type: "7z", signature: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] },
];

type ArchiveType = "zip" | "tar" | "gzip" | "7z" | "unknown";

/**
 * Phase 1: Unpack and inventory.
 *
 * 1. Detect archive type by magic bytes
 * 2. Extract using shell commands (via Bun.spawn with argv array, no shell injection)
 * 3. Path traversal prevention
 * 4. Archive bomb checks
 * 5. SHA-256 every extracted file
 * 6. Classify file type
 * 7. Parse fxmanifest.lua / __resource.lua
 * 8. Return inventory
 */
export async function unpack(artifactPath: string, scratchDir: string): Promise<Inventory> {
  const extractDir = join(scratchDir, "extracted");
  await mkdir(extractDir, { recursive: true });

  // Detect archive type
  const archiveType = await detectArchiveType(artifactPath);

  // Extract
  await extractArchive(artifactPath, extractDir, archiveType);

  // Walk extracted files, enforce limits, build inventory
  const files: InventoryFile[] = [];

  await walkDirectory(extractDir, extractDir, files, {
    totalSize: { value: 0 },
    fileCount: { value: 0 },
    currentDepth: 0,
  });

  // Parse manifest if present
  const manifest = await findAndParseManifest(extractDir, files);

  return { files, manifest };
}

/**
 * Detect archive type by reading magic bytes from the file header.
 */
async function detectArchiveType(filePath: string): Promise<ArchiveType> {
  const file = Bun.file(filePath);
  const buffer = new Uint8Array(await file.slice(0, 300).arrayBuffer());

  for (const { type, signature, offset = 0 } of MAGIC_BYTES) {
    if (buffer.length < offset + signature.length) continue;

    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[offset + i] !== signature[i]) {
        match = false;
        break;
      }
    }
    if (match) return type;
  }

  return "unknown";
}

/**
 * Extract an archive using Bun.spawn with explicit argv arrays
 * (no shell interpolation, safe from injection).
 */
async function extractArchive(
  archivePath: string,
  extractDir: string,
  archiveType: ArchiveType,
): Promise<void> {
  let cmd: string[];

  switch (archiveType) {
    case "zip":
      cmd = ["unzip", "-o", "-d", extractDir, archivePath];
      break;
    case "tar":
      cmd = ["tar", "-xf", archivePath, "-C", extractDir];
      break;
    case "gzip":
      // Could be tar.gz or standalone gzip
      cmd = ["tar", "-xzf", archivePath, "-C", extractDir];
      break;
    case "7z":
      cmd = ["7z", "x", `-o${extractDir}`, "-y", archivePath];
      break;
    case "unknown":
      // Try tar first, then unzip as fallback
      try {
        const tarProc = Bun.spawn(["tar", "-xf", archivePath, "-C", extractDir], {
          stdout: "ignore",
          stderr: "pipe",
        });
        const tarExit = await tarProc.exited;
        if (tarExit === 0) return;
      } catch {
        // Continue to fallback
      }
      cmd = ["unzip", "-o", "-d", extractDir, archivePath];
      break;
  }

  const proc = Bun.spawn(cmd, {
    stdout: "ignore",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Archive extraction failed (exit ${exitCode}): ${stderr.slice(0, 500)}`);
  }
}

interface WalkCounters {
  totalSize: { value: number };
  fileCount: { value: number };
  currentDepth: number;
}

/**
 * Recursively walk extracted directory, enforcing limits and building inventory.
 */
async function walkDirectory(
  dir: string,
  rootDir: string,
  files: InventoryFile[],
  counters: WalkCounters,
): Promise<void> {
  // Nesting depth check
  if (counters.currentDepth > LIMITS.MAX_ARCHIVE_DEPTH) {
    throw new Error(
      `Archive nesting depth exceeds limit of ${LIMITS.MAX_ARCHIVE_DEPTH}`,
    );
  }

  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(rootDir, fullPath);

    // Path traversal prevention
    validatePath(relPath);

    if (entry.isDirectory()) {
      await walkDirectory(fullPath, rootDir, files, {
        ...counters,
        currentDepth: counters.currentDepth + 1,
      });
    } else if (entry.isFile()) {
      // File count check
      counters.fileCount.value++;
      if (counters.fileCount.value > LIMITS.MAX_FILE_COUNT) {
        throw new Error(
          `Archive file count exceeds limit of ${LIMITS.MAX_FILE_COUNT}`,
        );
      }

      const fileStat = await stat(fullPath);

      // Decompressed size check
      counters.totalSize.value += fileStat.size;
      if (counters.totalSize.value > LIMITS.MAX_DECOMPRESSED_SIZE) {
        throw new Error(
          `Archive decompressed size exceeds limit of ${LIMITS.MAX_DECOMPRESSED_SIZE / (1024 * 1024)}MB`,
        );
      }

      // SHA-256 hash
      const content = await readFile(fullPath);
      const sha256 = createHash("sha256").update(content).digest("hex");

      // Classify file type
      const fileType = classifyFileType(relPath);

      files.push({
        path: relPath,
        sha256,
        size: fileStat.size,
        type: fileType,
      });
    }
  }
}

/**
 * Validate a relative path for traversal attacks.
 */
function validatePath(relPath: string): void {
  const normalized = normalize(relPath);

  // Reject path traversal
  if (normalized.includes("..")) {
    throw new Error(`Path traversal detected in archive entry: ${relPath}`);
  }

  // Reject absolute paths
  if (relPath.startsWith("/") || relPath.startsWith("\\")) {
    throw new Error(`Absolute path detected in archive entry: ${relPath}`);
  }
}

/**
 * Classify a file by its extension into one of the supported types.
 */
function classifyFileType(filePath: string): InventoryFile["type"] {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath).toLowerCase();

  // Manifest files
  if (name === "fxmanifest.lua" || name === "__resource.lua") {
    return "manifest";
  }

  switch (ext) {
    case ".lua":
      return "lua";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "js";
    case ".dll":
    case ".so":
    case ".exe":
    case ".bin":
      return "binary";
    default:
      return "other";
  }
}

/**
 * Find and parse fxmanifest.lua or __resource.lua in the extracted directory.
 */
async function findAndParseManifest(
  extractDir: string,
  files: InventoryFile[],
): Promise<ParsedManifest | undefined> {
  // Look for manifest files in the inventory
  const manifestFile = files.find(
    (f) =>
      f.type === "manifest" &&
      (basename(f.path).toLowerCase() === "fxmanifest.lua" ||
        basename(f.path).toLowerCase() === "__resource.lua"),
  );

  if (!manifestFile) {
    return undefined;
  }

  const content = await readFile(join(extractDir, manifestFile.path), "utf-8");
  return parseManifest(content);
}

/**
 * Parse a FiveM manifest file (fxmanifest.lua or __resource.lua).
 *
 * Extracts client_scripts, server_scripts, shared_scripts, files directives.
 */
function parseManifest(content: string): ParsedManifest {
  const manifest: ParsedManifest = {
    clientScripts: [],
    serverScripts: [],
    sharedScripts: [],
    files: [],
    allDeclared: [],
  };

  // Extract fx_version
  const fxVersionMatch = content.match(/fx_version\s+['"]([^'"]+)['"]/);
  if (fxVersionMatch) {
    manifest.fxVersion = fxVersionMatch[1];
  }

  // Extract game
  const gameMatch = content.match(/game\s+['"]([^'"]+)['"]/);
  if (gameMatch) {
    manifest.game = gameMatch[1];
  }

  // Parse script/file declarations
  // Supports both single string and table {} syntax:
  //   client_script 'foo.lua'
  //   client_scripts { 'foo.lua', 'bar.lua' }
  const directives: Array<{ key: string; target: string[] }> = [
    { key: "client_scripts?", target: manifest.clientScripts },
    { key: "server_scripts?", target: manifest.serverScripts },
    { key: "shared_scripts?", target: manifest.sharedScripts },
    { key: "files?", target: manifest.files },
  ];

  for (const { key, target } of directives) {
    // Match table syntax: directive { 'a', 'b', 'c' }
    const tableRegex = new RegExp(
      `${key}\\s*\\{([^}]*)\\}`,
      "gi",
    );
    let match: RegExpExecArray | null;

    while ((match = tableRegex.exec(content)) !== null) {
      const entries = match[1].match(/['"]([^'"]+)['"]/g);
      if (entries) {
        for (const entry of entries) {
          const cleaned = entry.replace(/['"]/g, "");
          target.push(cleaned);
        }
      }
    }

    // Match single string syntax: directive 'a'
    const singleRegex = new RegExp(
      `${key}\\s+['"]([^'"]+)['"]`,
      "gi",
    );

    while ((match = singleRegex.exec(content)) !== null) {
      // Avoid duplicates from table matches
      if (!target.includes(match[1])) {
        target.push(match[1]);
      }
    }
  }

  // Build allDeclared from all script/file references
  manifest.allDeclared = [
    ...new Set([
      ...manifest.clientScripts,
      ...manifest.serverScripts,
      ...manifest.sharedScripts,
      ...manifest.files,
    ]),
  ];

  return manifest;
}
