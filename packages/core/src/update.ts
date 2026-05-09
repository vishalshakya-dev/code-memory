import crypto from "node:crypto";
import path from "node:path";
import fs from "fs-extra";
import { simpleGit } from "simple-git";
import { inferDomains, writeDomainArtifacts } from "./analyze.js";
import { buildDependencyGraph, writeDependencyGraph } from "./dependency-graph.js";
import { detectProject } from "./detector.js";
import { buildContextIndex, buildProjectContextMarkdown, writeContextArtifacts } from "./generator.js";
import { contextStateSchema, type ContextState } from "./schema.js";
import { scanRepository } from "./scanner.js";
import type { UpdateResult } from "./types.js";
import { CODE_MEMORY_METADATA } from "./metadata.js";

function normalizePath(file: string): string {
  return file.split(path.sep).join("/");
}

async function sha1File(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash("sha1").update(buffer).digest("hex");
}

async function buildFileHashes(rootDir: string, files: string[]): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const abs = path.join(rootDir, file);
    if (await fs.pathExists(abs)) {
      hashes[file] = await sha1File(abs);
    }
  }
  return hashes;
}

async function readState(rootDir: string): Promise<ContextState | null> {
  const statePath = path.join(
    rootDir,
    CODE_MEMORY_METADATA.contextPaths.aiDir,
    CODE_MEMORY_METADATA.contextPaths.contextStateFile
  );
  if (!(await fs.pathExists(statePath))) return null;
  const raw = await fs.readJSON(statePath);
  return contextStateSchema.parse(raw);
}

async function getGitChangedFiles(rootDir: string): Promise<string[]> {
  try {
    const git = simpleGit(rootDir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) return [];
    const status = await git.status();
    const names = status.files.map((f) => normalizePath(f.path));
    return [...new Set(names)].sort();
  } catch {
    return [];
  }
}

function buildNextState(
  rootDir: string,
  generatedDomains: string[],
  fileHashes: Record<string, string>,
  nowIso: string
): ContextState {
  return contextStateSchema.parse({
    schemaVersion: 1,
    rootDir,
    lastAnalyzedAt: nowIso,
    generatedDomains: [...generatedDomains].sort(),
    fileHashes
  });
}

export async function updateContext(rootDir: string): Promise<UpdateResult> {
  const aiDir = path.join(rootDir, CODE_MEMORY_METADATA.contextPaths.aiDir);
  const statePath = path.join(aiDir, CODE_MEMORY_METADATA.contextPaths.contextStateFile);
  const currentState = await readState(rootDir);
  const changedFiles = await getGitChangedFiles(rootDir);

  const scanResult = await scanRepository(rootDir);
  const currentHashes = await buildFileHashes(rootDir, scanResult.files);

  const meaningfulChangedFiles = changedFiles.filter((file) => currentHashes[file] !== (currentState?.fileHashes[file] ?? ""));
  const hasMissingState = currentState === null;
  const hasMeaningfulChanges = hasMissingState || meaningfulChangedFiles.length > 0;

  if (!hasMeaningfulChanges) {
    return {
      upToDate: true,
      changedFiles,
      meaningfulChangedFiles,
      markdownPath: path.join(aiDir, CODE_MEMORY_METADATA.contextPaths.projectContextFile),
      indexPath: path.join(aiDir, CODE_MEMORY_METADATA.contextPaths.contextIndexFile),
      statePath,
      generatedDomainFiles: [],
      removedDomainFiles: []
    };
  }

  const detection = await detectProject(scanResult);
  const index = await buildContextIndex(scanResult, detection);
  const markdown = await buildProjectContextMarkdown(scanResult, detection, index);
  const { markdownPath, indexPath } = await writeContextArtifacts(rootDir, markdown, index);
  const dependencyGraph = await buildDependencyGraph(rootDir, scanResult.files);
  await writeDependencyGraph(rootDir, dependencyGraph);

  const summaries = inferDomains(index, dependencyGraph);
  const summaryByDomain = new Map(summaries.map((s) => [s.domain, s]));
  const generatedDomains = [...summaryByDomain.keys()].sort();

  const prevDomains = currentState?.generatedDomains ?? [];
  const removedDomains = prevDomains.filter((d) => !generatedDomains.includes(d));
  const addedDomains = generatedDomains.filter((d) => !prevDomains.includes(d));

  const affectedDomains = new Set<string>(addedDomains);
  for (const file of meaningfulChangedFiles) {
    for (const summary of summaries) {
      const files = summary.allFiles ?? summary.files;
      if (files.includes(file)) {
        affectedDomains.add(summary.domain);
      }
    }
  }

  // If files changed but no domain mapping matched (for example config-only edits), refresh all domains.
  if (meaningfulChangedFiles.length > 0 && affectedDomains.size === 0) {
    for (const domain of generatedDomains) affectedDomains.add(domain);
  }

  const selectedDomains = [...affectedDomains].sort();
  const { generatedFiles } = await writeDomainArtifacts(rootDir, index, summaries, selectedDomains);

  const removedDomainFiles: string[] = [];
  for (const domain of removedDomains) {
    const domainFile = path.join(aiDir, CODE_MEMORY_METADATA.contextPaths.domainsDir, `${domain}.md`);
    if (await fs.pathExists(domainFile)) {
      await fs.remove(domainFile);
      removedDomainFiles.push(domainFile);
    }
  }

  await fs.ensureDir(aiDir);
  const nextState = buildNextState(rootDir, generatedDomains, currentHashes, new Date().toISOString());
  await fs.writeJSON(statePath, nextState, { spaces: 2 });

  return {
    upToDate: false,
    changedFiles,
    meaningfulChangedFiles,
    markdownPath,
    indexPath,
    statePath,
    generatedDomainFiles: generatedFiles,
    removedDomainFiles: removedDomainFiles.sort()
  };
}
