import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { scanRepository } from "../src/scanner.js";

const tempDirs: string[] = [];

async function makeRepo(structure: string[]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-memory-scan-"));
  tempDirs.push(root);
  for (const filePath of structure) {
    await fs.ensureFile(path.join(root, filePath));
  }
  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((d) => fs.remove(d)));
  tempDirs.length = 0;
});

describe("scanRepository", () => {
  it("ignores known heavy directories", async () => {
    const root = await makeRepo([
      "src/index.ts",
      "node_modules/pkg/index.js",
      ".git/HEAD",
      "dist/out.js",
      "build/main.js",
      ".next/chunk.js",
      "vendor/lib.c",
      "coverage/lcov.info"
    ]);
    const result = await scanRepository(root);
    expect(result.files).toEqual(["src/index.ts"]);
  });

  it("finds nested files and excludes .ai output folder", async () => {
    const root = await makeRepo([
      "src/a/b/c.ts",
      "docs/README.md",
      ".ai/project-context.md",
      ".ai/context-index.json"
    ]);
    const result = await scanRepository(root);
    expect(result.files).toEqual(["docs/README.md", "src/a/b/c.ts"]);
  });
});
