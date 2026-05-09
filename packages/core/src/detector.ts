import path from "node:path";
import fg from "fast-glob";
import fs from "fs-extra";
import type { ProjectDetection, ProjectSignal, ScanResult } from "./types.js";

async function exists(rootDir: string, relPath: string): Promise<boolean> {
  return fs.pathExists(path.join(rootDir, relPath));
}

export async function detectProject(scan: ScanResult): Promise<ProjectDetection> {
  const signals: ProjectSignal[] = [];
  const rootDir = scan.rootDir;

  if (await exists(rootDir, "package.json")) signals.push("has-package-json");
  if (await exists(rootDir, "tsconfig.json")) signals.push("has-tsconfig");
  if ((await fg(["vite.config.*"], { cwd: rootDir, onlyFiles: true })).length > 0) {
    signals.push("has-vite-config");
  }
  if (await exists(rootDir, "supabase")) signals.push("has-supabase");
  if (await exists(rootDir, "prisma/schema.prisma")) signals.push("has-prisma");
  if (await exists(rootDir, "Dockerfile")) signals.push("has-dockerfile");
  if (
    (await fg(["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"], { cwd: rootDir, onlyFiles: true }))
      .length > 0
  ) {
    signals.push("has-docker-compose");
  }

  const kinds = new Set<string>();
  if (signals.includes("has-package-json")) kinds.add("node");
  if (signals.includes("has-tsconfig")) kinds.add("typescript");
  if (signals.includes("has-vite-config")) kinds.add("vite");
  if (signals.includes("has-supabase")) kinds.add("supabase");
  if (signals.includes("has-prisma")) kinds.add("prisma");
  if (signals.includes("has-dockerfile") || signals.includes("has-docker-compose")) kinds.add("docker");
  if (kinds.size === 0) kinds.add("generic");

  return {
    signals: [...signals].sort(),
    projectKinds: [...kinds].sort()
  };
}
