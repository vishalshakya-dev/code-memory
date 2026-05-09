import path from "node:path";
import fs from "fs-extra";
import type { DependencyGraph } from "./schema.js";
import { dependencyGraphSchema } from "./schema.js";
import { CODE_MEMORY_METADATA } from "./metadata.js";

const JS_TS_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const PY_EXTS = [".py"];
const PHP_EXTS = [".php"];

function normalize(p: string): string {
  return p.split(path.sep).join("/");
}

function extractJsTsImports(content: string): string[] {
  const refs = new Set<string>();
  const patterns = [
    /import\s+[^'"]*?\sfrom\s+['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) refs.add(match[1]);
  }
  return [...refs];
}

function extractPythonImports(content: string): string[] {
  const refs = new Set<string>();
  for (const match of content.matchAll(/^\s*from\s+([.\w]+)\s+import\s+([A-Za-z0-9_, ]+)$/gm)) {
    const module = match[1];
    refs.add(module);
    const imported = match[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const symbol of imported) refs.add(`${module}.${symbol}`);
  }
  for (const match of content.matchAll(/^\s*import\s+([.\w]+)/gm)) refs.add(match[1]);
  return [...refs];
}

function extractPhpImports(content: string): string[] {
  const refs = new Set<string>();
  for (const match of content.matchAll(/(?:require|require_once|include|include_once)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g)) {
    refs.add(match[1]);
  }
  for (const match of content.matchAll(/\buse\s+([A-Za-z0-9_\\]+)\s*;/g)) refs.add(match[1]);
  return [...refs];
}

function resolveRelative(fromFile: string, specifier: string, filesSet: Set<string>): string | null {
  const fromDir = path.posix.dirname(fromFile);
  const base = normalize(path.posix.normalize(path.posix.join(fromDir, specifier)));
  const candidates = [
    base,
    ...JS_TS_EXTS.map((e) => `${base}${e}`),
    ...PY_EXTS.map((e) => `${base}${e}`),
    ...PHP_EXTS.map((e) => `${base}${e}`),
    ...JS_TS_EXTS.map((e) => `${base}/index${e}`),
    `${base}/__init__.py`
  ];
  for (const c of candidates) if (filesSet.has(c)) return c;
  return null;
}

function resolvePythonModule(specifier: string, filesSet: Set<string>): string | null {
  const clean = specifier.replace(/^\.+/, "").replace(/\./g, "/");
  if (!clean) return null;
  const candidates = [`${clean}.py`, `${clean}/__init__.py`];
  for (const c of candidates) if (filesSet.has(c)) return c;
  return null;
}

function resolvePhpNamespace(specifier: string, filesSet: Set<string>): string | null {
  if (!specifier.includes("\\")) return null;
  const mapped = specifier.replace(/^\\+/, "").replace(/\\/g, "/");
  const candidates = [`${mapped}.php`, `app/${mapped}.php`, `src/${mapped}.php`];
  for (const c of candidates) if (filesSet.has(c)) return c;
  return null;
}

function resolveImport(fromFile: string, specifier: string, filesSet: Set<string>): string | null {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return resolveRelative(fromFile, specifier, filesSet);
  if (specifier.includes("/")) {
    const direct = specifier.replace(/^\/+/, "");
    if (filesSet.has(direct)) return direct;
    for (const ext of [...JS_TS_EXTS, ...PY_EXTS, ...PHP_EXTS]) {
      if (filesSet.has(`${direct}${ext}`)) return `${direct}${ext}`;
    }
  }
  const py = resolvePythonModule(specifier, filesSet);
  if (py) return py;
  const php = resolvePhpNamespace(specifier, filesSet);
  if (php) return php;
  return null;
}

function refsForFile(file: string, content: string): string[] {
  const ext = path.extname(file).toLowerCase();
  if (JS_TS_EXTS.includes(ext)) return extractJsTsImports(content);
  if (PY_EXTS.includes(ext)) return extractPythonImports(content);
  if (PHP_EXTS.includes(ext)) return extractPhpImports(content);
  return [];
}

export async function buildDependencyGraph(rootDir: string, files: string[]): Promise<DependencyGraph> {
  const filesSet = new Set(files);
  const nodes: Record<string, string[]> = {};

  for (const file of files.sort()) {
    try {
      const abs = path.join(rootDir, file);
      const content = await fs.readFile(abs, "utf8");
      const refs = refsForFile(file, content);
      const resolved = refs
        .map((r) => resolveImport(file, r, filesSet))
        .filter((v): v is string => Boolean(v) && v !== file);
      nodes[file] = [...new Set(resolved)].sort();
    } catch {
      nodes[file] = [];
    }
  }

  return dependencyGraphSchema.parse({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    rootDir,
    nodes
  });
}

export async function writeDependencyGraph(rootDir: string, graph: DependencyGraph): Promise<string> {
  const graphPath = path.join(
    rootDir,
    CODE_MEMORY_METADATA.contextPaths.aiDir,
    CODE_MEMORY_METADATA.contextPaths.dependencyGraphFile
  );
  await fs.ensureDir(path.dirname(graphPath));
  await fs.writeJSON(graphPath, graph, { spaces: 2 });
  return graphPath;
}
