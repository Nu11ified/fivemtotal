import * as path from "node:path";
import * as fs from "node:fs/promises";

const STORAGE_ROOT = process.env.STORAGE_PATH ?? "./data/artifacts";

/**
 * Store an artifact file to content-addressable local storage.
 * Layout: {STORAGE_ROOT}/{sha256[0:2]}/{sha256}/archive
 */
export async function storeArtifact(
  sha256: string,
  data: Buffer
): Promise<string> {
  const prefix = sha256.slice(0, 2);
  const dir = path.join(STORAGE_ROOT, prefix, sha256);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, "archive");
  await Bun.write(filePath, data);
  return dir;
}

/**
 * Load an artifact file from its storage path.
 */
export async function loadArtifact(storagePath: string): Promise<Buffer> {
  return Buffer.from(
    await Bun.file(path.join(storagePath, "archive")).arrayBuffer()
  );
}
