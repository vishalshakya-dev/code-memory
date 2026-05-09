import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { simpleGit } from "simple-git";
import { afterEach, describe, expect, it } from "vitest";
import { initializeContext } from "../src/init.js";
import { analyzeContext } from "../src/analyze.js";
import { updateContext } from "../src/update.js";

const tempDirs: string[] = [];

async function createRepo(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-memory-update-"));
  tempDirs.push(root);

  await fs.ensureFile(path.join(root, "package.json"));
  await fs.ensureFile(path.join(root, "src/components/Button.tsx"));
  await fs.ensureFile(path.join(root, "src/api/users.ts"));
  await fs.ensureFile(path.join(root, "prisma/schema.prisma"));
  await fs.ensureFile(path.join(root, "README.md"));

  const git = simpleGit(root);
  await git.init();
  await git.addConfig("user.email", "code-memory@example.com");
  await git.addConfig("user.name", "CodeMemory");
  await git.add(".");
  await git.commit("baseline");

  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((d) => fs.remove(d)));
  tempDirs.length = 0;
});

describe("updateContext", () => {
  it("returns up-to-date when no meaningful git changes exist", async () => {
    const root = await createRepo();
    await initializeContext(root);
    await analyzeContext(root);

    const git = simpleGit(root);
    await git.add(".");
    await git.commit("context artifacts");

    const result = await updateContext(root);
    expect(result.upToDate).toBe(true);
    expect(result.meaningfulChangedFiles).toEqual([]);
  });

  it("regenerates only affected domains and updates context-state", async () => {
    const root = await createRepo();
    await initializeContext(root);
    await analyzeContext(root);

    const git = simpleGit(root);
    await git.add(".");
    await git.commit("context artifacts");

    await fs.writeFile(path.join(root, "src/components/Button.tsx"), "export const Button = () => null;\n", "utf8");
    const result = await updateContext(root);

    expect(result.upToDate).toBe(false);
    expect(result.meaningfulChangedFiles).toContain("src/components/Button.tsx");
    expect(result.generatedDomainFiles.some((f) => f.endsWith("/frontend.md"))).toBe(true);
    expect(result.generatedDomainFiles.some((f) => f.endsWith("/backend.md"))).toBe(false);

    const state = await fs.readJSON(path.join(root, ".ai", "context-state.json"));
    expect(typeof state.lastAnalyzedAt).toBe("string");
    expect(Array.isArray(state.generatedDomains)).toBe(true);
    expect(typeof state.fileHashes["src/components/Button.tsx"]).toBe("string");
  });
});
