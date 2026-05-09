import path from "node:path";
import fg from "fast-glob";
import { DEFAULT_IGNORE_PATTERNS, type ScanResult } from "./types.js";

export async function scanRepository(rootDir: string): Promise<ScanResult> {
  const files = await fg(["**/*"], {
    cwd: rootDir,
    dot: true,
    onlyFiles: true,
    unique: true,
    ignore: [...DEFAULT_IGNORE_PATTERNS]
  });

  const normalized = files.map((f) => f.split(path.sep).join("/")).sort();

  return {
    rootDir,
    files: normalized,
    ignored: [...DEFAULT_IGNORE_PATTERNS]
  };
}
