import { detectProject } from "./detector.js";
import { buildContextIndex, buildProjectContextMarkdown, writeContextArtifacts } from "./generator.js";
import { scanRepository } from "./scanner.js";
import { inferDomains } from "./analyze.js";
import { buildDependencyGraph, writeDependencyGraph } from "./dependency-graph.js";
import fs from "fs-extra";
import path from "node:path";
import crypto from "node:crypto";
import type { InitResult } from "./types.js";
import { contextStateSchema } from "./schema.js";
import { CODE_MEMORY_METADATA } from "./metadata.js";

async function sha1File(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

async function buildFileHashes(rootDir: string, files: string[]): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const abs = path.join(rootDir, file);
    if (await fs.pathExists(abs)) hashes[file] = await sha1File(abs);
  }
  return hashes;
}

export async function initializeContext(rootDir: string): Promise<InitResult> {
  const scanResult = await scanRepository(rootDir);
  const detection = await detectProject(scanResult);
  const index = await buildContextIndex(scanResult, detection);
  const markdown = await buildProjectContextMarkdown(scanResult, detection, index);
  const { markdownPath, indexPath } = await writeContextArtifacts(rootDir, markdown, index);
  const dependencyGraph = await buildDependencyGraph(rootDir, scanResult.files);
  await writeDependencyGraph(rootDir, dependencyGraph);
  const domains = inferDomains(index, dependencyGraph).map((s) => s.domain).sort();
  const fileHashes = await buildFileHashes(rootDir, scanResult.files);
  const state = contextStateSchema.parse({
    schemaVersion: 1,
    rootDir,
    lastAnalyzedAt: new Date().toISOString(),
    generatedDomains: domains,
    fileHashes
  });
  await fs.writeJSON(
    path.join(
      rootDir,
      CODE_MEMORY_METADATA.contextPaths.aiDir,
      CODE_MEMORY_METADATA.contextPaths.contextStateFile
    ),
    state,
    { spaces: 2 }
  );

  return {
    markdownPath,
    indexPath,
    scanResult,
    detection
  };
}
