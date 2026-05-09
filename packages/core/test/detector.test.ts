import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { detectProject } from "../src/detector.js";
import { scanRepository } from "../src/scanner.js";

const tempDirs: string[] = [];

async function makeRepo(structure: string[]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-memory-detect-"));
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

describe("detectProject", () => {
  it("detects node + typescript + vite", async () => {
    const root = await makeRepo(["package.json", "tsconfig.json", "vite.config.ts"]);
    const detection = await detectProject(await scanRepository(root));
    expect(detection.signals).toEqual(["has-package-json", "has-tsconfig", "has-vite-config"]);
    expect(detection.projectKinds).toEqual(["node", "typescript", "vite"]);
  });

  it("detects supabase + prisma + docker", async () => {
    const root = await makeRepo([
      "supabase/config.toml",
      "prisma/schema.prisma",
      "Dockerfile",
      "docker-compose.yml"
    ]);
    const detection = await detectProject(await scanRepository(root));
    expect(detection.signals).toEqual([
      "has-docker-compose",
      "has-dockerfile",
      "has-prisma",
      "has-supabase"
    ]);
    expect(detection.projectKinds).toEqual(["docker", "prisma", "supabase"]);
  });

  it("falls back to generic for empty repo", async () => {
    const root = await makeRepo([]);
    const detection = await detectProject(await scanRepository(root));
    expect(detection.signals).toEqual([]);
    expect(detection.projectKinds).toEqual(["generic"]);
  });
});
