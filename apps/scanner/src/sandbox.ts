import { LIMITS } from "@fivemtotal/shared";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface SandboxResult {
  success: boolean;
  data?: unknown;
  error?: string;
  exitCode: number;
}

/**
 * Fork a sandboxed subprocess to run the analysis pipeline.
 *
 * Uses `unshare --mount --net` for namespace isolation when available,
 * with ulimit constraints for memory and CPU time.
 * Wall-clock timeout: 120s hard kill from parent.
 * Creates a tmpfs scratch workspace that is auto-cleaned.
 */
export async function runInSandbox(
  artifactPath: string,
  scanJobId: string,
): Promise<SandboxResult> {
  const scratchDir = await mkdtemp(join(tmpdir(), `scan-${scanJobId}-`));

  try {
    const entryScript = join(import.meta.dir, "sandbox-entry.ts");

    // Build the command with namespace isolation and resource limits.
    // Shell quoting: all path/ID arguments are single-quoted to prevent injection.
    const useUnshare = await canUseUnshare();
    const memoryKB = LIMITS.SANDBOX_MEMORY_MB * 1024;
    const cpuTimeout = LIMITS.SANDBOX_CPU_TIMEOUT_S;

    const q = (s: string): string => `'${s.replace(/'/g, "'\\''")}'`;
    const innerCmd = `ulimit -v ${memoryKB} -t ${cpuTimeout}; exec bun run ${q(entryScript)} ${q(artifactPath)} ${q(scratchDir)} ${q(scanJobId)}`;

    const args: string[] = useUnshare
      ? ["unshare", "--mount", "--net", "--", "bash", "-c", innerCmd]
      : ["bash", "-c", innerCmd];

    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        SCAN_JOB_ID: scanJobId,
        SCRATCH_DIR: scratchDir,
      },
    });

    // Wall-clock timeout: hard kill after SANDBOX_WALL_TIMEOUT_S
    const wallTimeout = LIMITS.SANDBOX_WALL_TIMEOUT_S * 1000;
    const timeoutId = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // Process may have already exited
      }
    }, wallTimeout);

    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      return {
        success: false,
        error: stderr || `Sandbox process exited with code ${exitCode}`,
        exitCode,
      };
    }

    // Parse JSON output from sandbox-entry.ts
    try {
      const data = JSON.parse(stdout.trim());
      return { success: true, data, exitCode: 0 };
    } catch {
      return {
        success: false,
        error: `Failed to parse sandbox output: ${stdout.slice(0, 500)}`,
        exitCode,
      };
    }
  } finally {
    // Auto-clean scratch workspace
    await rm(scratchDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Check if unshare is available (requires root or user namespace support).
 */
async function canUseUnshare(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["unshare", "--mount", "--net", "true"], {
      stdout: "ignore",
      stderr: "ignore",
    });
    const code = await proc.exited;
    return code === 0;
  } catch {
    return false;
  }
}
