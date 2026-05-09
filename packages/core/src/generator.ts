import path from "node:path";
import fs from "fs-extra";
import { simpleGit } from "simple-git";
import type { ContextIndex } from "./schema.js";
import { contextIndexSchema } from "./schema.js";
import type { ProjectDetection, ScanResult } from "./types.js";
import { CODE_MEMORY_METADATA, getProjectContextFooter } from "./metadata.js";

function categorizeFiles(files: string[]) {
  return {
    configs: files.filter((f) =>
      /(^|\/)(package\.json|tsconfig\.json|vite\.config\..+|pnpm-workspace\.yaml|Dockerfile|docker-compose\.(yml|yaml)|compose\.(yml|yaml))$/i.test(
        f
      )
    ),
    source: files.filter((f) => /(^|\/)src\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(f)),
    tests: files.filter((f) => /(^|\/)(test|tests|__tests__)\/|\.test\.(ts|tsx|js|jsx)$/i.test(f)),
    docs: files.filter((f) => /(^|\/)(README(\.md)?|docs\/|.+\.md)$/i.test(f)),
    infra: files.filter((f) => /(^|\/)(supabase\/|prisma\/|\.github\/|docker\/)/i.test(f))
  };
}

async function getGitBranch(rootDir: string): Promise<string | null> {
  try {
    const git = simpleGit(rootDir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return null;
    const status = await git.status();
    return status.current || null;
  } catch {
    return null;
  }
}

export async function buildContextIndex(scan: ScanResult, detection: ProjectDetection): Promise<ContextIndex> {
  const index: ContextIndex = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    rootDir: scan.rootDir,
    ignored: scan.ignored,
    scannedFileCount: scan.files.length,
    signals: detection.signals,
    projectKinds: detection.projectKinds,
    categories: categorizeFiles(scan.files)
  };

  return contextIndexSchema.parse(index);
}

export async function buildProjectContextMarkdown(
  scan: ScanResult,
  detection: ProjectDetection,
  index: ContextIndex
): Promise<string> {
  const repoName = path.basename(scan.rootDir);
  const branch = await getGitBranch(scan.rootDir);

  const lines = [
    "# Project Context",
    "",
    `- Project: ${repoName}`,
    `- Root: ${scan.rootDir}`,
    `- Generated At: ${index.generatedAt}`,
    `- Git Branch: ${branch ?? "not-a-git-repo"}`,
    `- Project Kinds: ${detection.projectKinds.join(", ") || "generic"}`,
    `- Signals: ${detection.signals.join(", ") || "none"}`,
    "",
    "## File Summary",
    "",
    `- Total scanned files: ${scan.files.length}`,
    `- Config files: ${index.categories.configs.length}`,
    `- Source files: ${index.categories.source.length}`,
    `- Test files: ${index.categories.tests.length}`,
    `- Documentation files: ${index.categories.docs.length}`,
    `- Infra files: ${index.categories.infra.length}`,
    "",
    "## Notable Files",
    ""
  ];

  const notable = [
    ...index.categories.configs,
    ...index.categories.infra.slice(0, 10),
    ...index.categories.docs.slice(0, 10)
  ].slice(0, 30);

  if (notable.length === 0) {
    lines.push("- (none detected)");
  } else {
    for (const file of notable) {
      lines.push(`- ${file}`);
    }
  }

  lines.push("", getProjectContextFooter());
  return lines.join("\n");
}

export async function writeContextArtifacts(
  rootDir: string,
  markdown: string,
  index: ContextIndex
): Promise<{ markdownPath: string; indexPath: string }> {
  const aiDir = path.join(rootDir, CODE_MEMORY_METADATA.contextPaths.aiDir);
  const markdownPath = path.join(aiDir, CODE_MEMORY_METADATA.contextPaths.projectContextFile);
  const indexPath = path.join(aiDir, CODE_MEMORY_METADATA.contextPaths.contextIndexFile);

  await fs.ensureDir(aiDir);
  await fs.writeFile(markdownPath, markdown, "utf8");
  await fs.writeJSON(indexPath, index, { spaces: 2 });

  return { markdownPath, indexPath };
}
