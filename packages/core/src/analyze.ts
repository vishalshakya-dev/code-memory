import path from "node:path";
import fs from "fs-extra";
import { contextIndexSchema, dependencyGraphSchema, type ContextIndex, type DependencyGraph } from "./schema.js";
import type { AnalyzeResult, DomainSummary } from "./types.js";
import { CODE_MEMORY_METADATA, getDomainFooter } from "./metadata.js";
import { detectConcepts } from "./rules/concepts.js";
import { DOMAIN_RULE_DEFINITIONS, type DomainRuleDefinition } from "./rules/domains.js";
import { inferEntryPoints } from "./rules/entrypoints.js";
import { detectStacks } from "./rules/stacks.js";
import { detectTechnologies } from "./rules/technologies.js";

const MAX_MATCHED_FILES = 15;

const DOMAIN_AFFINITY_PATTERNS: Record<string, RegExp> = {
  auth: /(auth|login|session|protected|user|oauth|jwt|signup|rbac|permission)/i,
  integrations: /(webhook|provider|stripe|razorpay|adapter|integration|callback)/i,
  admin: /(admin|dashboard|moderation|management)/i,
  frontend: /(component|page|view|layout|screen|hook|ui)/i,
  backend: /(service|controller|handler|orchestr|server|api)/i,
  database: /(schema|migration|model|prisma|supabase|db|seed)/i
};
const GENERIC_UI_PENALTY_PATTERN = /(example|demo|sample|story|storybook|preview|placeholder|skeleton)/i;
const HIGH_SIGNAL_BASENAME_PATTERN = /(hook|service|provider|route|controller|handler|middleware|auth|session|api|webhook)/i;

function normalizeDomainName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function scoreFileRelevance(file: string, domain: string): number {
  let score = 0;
  const base = path.basename(file).toLowerCase();
  if (new RegExp(`(^|/)${domain}(/|\\.|$)`, "i").test(file)) score += 8;
  if (/(^|\/)(src|app|pages|api|server|services|controllers|routes|routers|app\/Http\/Controllers|models|database)\//i.test(file))
    score += 5;
  if (/(index|main|app|server|client|router|route|manage|artisan)\.(ts|tsx|js|jsx|py|php)$/i.test(file)) score += 6;
  if (/config|schema|migration|controller|service|hook|provider|model|webhook/i.test(file)) score += 4;
  if (/\.(md|test|spec)\./i.test(file) || /\.(md)$/i.test(file)) score -= 2;
  if (HIGH_SIGNAL_BASENAME_PATTERN.test(base)) score += 3;
  if (GENERIC_UI_PENALTY_PATTERN.test(base)) score -= 4;
  const affinityPattern = DOMAIN_AFFINITY_PATTERNS[domain];
  if (affinityPattern) {
    if (affinityPattern.test(file)) score += 5;
    else score -= 2;
  }
  score -= Math.min(file.split("/").length, 8);
  return score;
}

function topRelevantFiles(files: string[], domain: string): string[] {
  return [...files]
    .sort((a, b) => {
      const delta = scoreFileRelevance(b, domain) - scoreFileRelevance(a, domain);
      return delta !== 0 ? delta : a.localeCompare(b);
    })
    .slice(0, MAX_MATCHED_FILES);
}

function mergeDomainSummaries(summaries: DomainSummary[]): DomainSummary[] {
  const merged = new Map<string, DomainSummary>();
  for (const summary of summaries) {
    const existing = merged.get(summary.domain);
    if (!existing) {
      merged.set(summary.domain, {
        ...summary,
        files: [...summary.files],
        allFiles: [...(summary.allFiles ?? summary.files)]
      });
      continue;
    }

    const allReasons = new Set<string>();
    for (const part of [existing.reason, summary.reason]) {
      for (const token of part.split(";").map((s) => s.trim()).filter(Boolean)) allReasons.add(token);
    }

    const combinedAllFiles = [...new Set([...(existing.allFiles ?? existing.files), ...(summary.allFiles ?? summary.files)])];
    const combinedTopFiles = topRelevantFiles(combinedAllFiles, summary.domain);
    merged.set(summary.domain, {
      domain: summary.domain,
      reason: [...allReasons].join("; "),
      files: combinedTopFiles,
      allFiles: combinedAllFiles
    });
  }
  return [...merged.values()];
}

function fileExt(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ext;
}

function matchWeightedDomain(
  rule: DomainRuleDefinition,
  files: string[],
  concepts: string[],
  entryPoints: string[],
  graph?: DependencyGraph
): { confidence: number; matched: string[] } {
  const matched = files.filter((f) => {
    const base = path.basename(f);
    const ext = fileExt(f);
    return (
      rule.pathPatterns.some((p) => p.test(f)) ||
      rule.filenamePatterns.some((p) => p.test(base)) ||
      rule.frameworkFolders.some((p) => p.test(f)) ||
      rule.configFiles.some((p) => p.test(f)) ||
      rule.extensions.includes(ext)
    );
  });

  const pathHits = matched.filter((f) => rule.pathPatterns.some((p) => p.test(f))).length;
  const filenameHits = matched.filter((f) => rule.filenamePatterns.some((p) => p.test(path.basename(f)))).length;
  const extensionHits = matched.filter((f) => rule.extensions.includes(fileExt(f))).length;
  const frameworkHits = matched.filter((f) => rule.frameworkFolders.some((p) => p.test(f))).length;
  const configHits = files.filter((f) => rule.configFiles.some((p) => p.test(f))).length;
  const conceptHits = concepts.filter((c) => rule.conceptKeywords.some((k) => c.includes(k))).length;
  const entryHits = entryPoints.filter((e) => rule.pathPatterns.some((p) => p.test(e)) || rule.filenamePatterns.some((p) => p.test(path.basename(e)))).length;
  const graphConnectedHits = graph
    ? matched.filter((f) => (graph.nodes[f] ?? []).some((dep) => matched.includes(dep))).length
    : 0;

  let confidence =
    pathHits * 4 +
    filenameHits * 3 +
    extensionHits * 1 +
    frameworkHits * 4 +
    configHits * 5 +
    conceptHits * 6 +
    entryHits * 5 +
    graphConnectedHits * 2;

  if (rule.domain === "auth") {
    const authRepeatHits = matched.filter((f) =>
      /(AuthModal|ProtectedRoute|useAuth|login|session|signup|user|jwt|oauth|authprovider|protected)/i.test(f)
    ).length;
    confidence += Math.min(authRepeatHits, 8) * 3;
    if (
      graph &&
      matched.some((f) => /auth|login|session|protected|user/i.test(f)) &&
      matched.some((f) => (graph.nodes[f] ?? []).some((dep) => /auth|login|session|protected|user/i.test(dep)))
    ) {
      confidence += 8;
    }
  }
  if (rule.domain === "integrations") {
    if (matched.some((f) => /webhook/i.test(f))) confidence += 8;
    if (matched.some((f) => /(integrations?|providers?|adapters?)/i.test(f))) confidence += 4;
    if (
      graph &&
      matched.some((f) => /webhook|provider|integration/i.test(f)) &&
      matched.some((f) => (graph.nodes[f] ?? []).some((dep) => /webhook|provider|integration/i.test(dep)))
    ) {
      confidence += 8;
    }
  }
  if (rule.domain === "admin") {
    if (matched.some((f) => /(dashboard|admin)/i.test(f))) confidence += 6;
  }

  return { confidence, matched };
}

function inferDomains(index: ContextIndex, graph?: DependencyGraph): DomainSummary[] {
  const files = [
    ...index.categories.configs,
    ...index.categories.source,
    ...index.categories.tests,
    ...index.categories.docs,
    ...index.categories.infra
  ];
  const uniqueFiles = [...new Set(files)].sort();
  const concepts = detectConcepts(uniqueFiles);
  const entryPoints = inferEntryPoints(uniqueFiles);

  const summaries: DomainSummary[] = [];
  for (const rule of DOMAIN_RULE_DEFINITIONS) {
    const { confidence, matched } = matchWeightedDomain(rule, uniqueFiles, concepts, entryPoints, graph);
    const minFiles = rule.minFiles ?? 1;
    const authGate = rule.domain !== "auth" || concepts.includes("authentication");
    if (confidence >= rule.minConfidence && matched.length >= minFiles && authGate) {
      summaries.push({
        domain: normalizeDomainName(rule.domain),
        reason: `${rule.reason} (confidence ${confidence})`,
        files: topRelevantFiles(matched, rule.domain),
        allFiles: matched
      });
    }
  }

  const mergedSummaries = mergeDomainSummaries(summaries);

  if (mergedSummaries.length === 0) {
    return [
      {
        domain: "general",
        reason: "No domain-specific patterns matched",
        files: topRelevantFiles(uniqueFiles, "general"),
        allFiles: uniqueFiles
      }
    ];
  }

  return mergedSummaries.sort((a, b) => a.domain.localeCompare(b.domain));
}

function inferPurpose(domain: string): string {
  if (domain === "frontend") return "Presents user-facing views, flows, and interactive UI.";
  if (domain === "backend") return "Handles API endpoints, business logic, and service orchestration.";
  if (domain === "database") return "Defines persistence models, migrations, and data access boundaries.";
  if (domain === "auth") return "Manages identity, sessions, and access control rules.";
  if (domain === "admin") return "Hosts dashboard and administrative user workflows.";
  if (domain === "integrations") return "Connects external providers, webhooks, and third-party services.";
  if (domain === "api") return "Defines HTTP API boundaries and route contracts.";
  if (domain === "jobs") return "Runs background processing and scheduled tasks.";
  if (domain === "testing") return "Validates behavior through automated test coverage.";
  if (domain === "docs") return "Captures engineering and product knowledge for contributors.";
  if (domain === "infrastructure") return "Supports deployment, runtime environment, and CI operations.";
  return "Groups files with related responsibilities in this codebase.";
}

function inferKeyFolders(files: string[]): string[] {
  const counts = new Map<string, number>();
  for (const file of files) {
    const parts = file.split("/");
    if (parts.length < 2) continue;
    const folder = parts.slice(0, 2).join("/");
    counts.set(folder, (counts.get(folder) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([folder]) => folder);
}

function inferResponsibilities(domain: string, technologies: string[], concepts: string[]): string[] {
  const responsibilities: string[] = [];
  if (domain === "frontend") responsibilities.push("Render pages and component-driven UI");
  if (domain === "backend") responsibilities.push("Expose APIs and orchestrate services");
  if (domain === "database") responsibilities.push("Define schemas and migration paths");
  if (domain === "auth") responsibilities.push("Handle login, session, and permissions lifecycle");
  if (domain === "integrations") responsibilities.push("Integrate third-party providers and webhooks");
  if (domain === "admin") responsibilities.push("Support dashboard and admin operations");
  if (domain === "jobs") responsibilities.push("Run asynchronous workers and scheduled tasks");
  if (domain === "api") responsibilities.push("Maintain route handlers and API contracts");
  if (domain === "testing") responsibilities.push("Own test suites and behavior verification");
  if (domain === "docs") responsibilities.push("Document architecture and contributor workflows");
  if (domain === "infrastructure") responsibilities.push("Manage deployment and runtime configuration");
  if (responsibilities.length === 0) responsibilities.push("Own files and logic associated with this domain");
  if (technologies.includes("FastAPI")) responsibilities.push("Organize router-based Python API modules");
  if (technologies.includes("Laravel")) responsibilities.push("Coordinate Laravel controllers, models, and routes");
  if (concepts.includes("analytics")) responsibilities.push("Support analytics-oriented features");
  return [...new Set(responsibilities)].slice(0, 5);
}

function renderDomainMarkdown(summary: DomainSummary, index: ContextIndex): string {
  const analysisFiles = summary.allFiles ?? summary.files;
  const stacks = detectStacks(analysisFiles);
  const technologies = detectTechnologies(index, analysisFiles, stacks);
  const concepts = detectConcepts(analysisFiles);
  const keyFolders = inferKeyFolders(analysisFiles);
  const responsibilities = inferResponsibilities(summary.domain, technologies, concepts);
  const entryPoints = inferEntryPoints(analysisFiles, summary.domain);

  const lines = [`# ${summary.domain} domain`, "", "## Purpose", "", inferPurpose(summary.domain), "", "## Key folders", ""];

  if (keyFolders.length === 0) lines.push("- (none)");
  for (const folder of keyFolders) lines.push(`- ${folder}`);

  lines.push("", "## Detected technologies", "");
  if (technologies.length === 0) lines.push("- (none)");
  for (const tech of technologies.slice(0, 12)) lines.push(`- ${tech}`);

  lines.push("", "## Main responsibilities", "");
  for (const responsibility of responsibilities) lines.push(`- ${responsibility}`);

  lines.push("", "## Important entry points", "");
  if (entryPoints.length === 0) lines.push("- (none)");
  for (const entry of entryPoints) lines.push(`- ${entry}`);

  lines.push("", "## Detected Concepts", "");
  if (concepts.length === 0) lines.push("- (none)");
  for (const concept of concepts.slice(0, 10)) lines.push(`- ${concept}`);

  lines.push("", "## Top relevant files", "");
  for (const file of summary.files) lines.push(`- ${file}`);

  lines.push("", `- Reason: ${summary.reason}`, `- Context schema version: ${index.schemaVersion}`, "");
  lines.push(getDomainFooter());
  return lines.join("\n");
}

export async function writeDomainArtifacts(
  rootDir: string,
  index: ContextIndex,
  summaries: DomainSummary[],
  onlyDomains?: string[]
): Promise<{ domainsDir: string; generatedFiles: string[] }> {
  const domainsDir = path.join(
    rootDir,
    CODE_MEMORY_METADATA.contextPaths.aiDir,
    CODE_MEMORY_METADATA.contextPaths.domainsDir
  );
  await fs.ensureDir(domainsDir);

  const selected = onlyDomains ? summaries.filter((s) => onlyDomains.includes(s.domain)) : summaries;
  const generatedFiles: string[] = [];
  for (const summary of selected) {
    const filePath = path.join(domainsDir, `${summary.domain}.md`);
    const markdown = renderDomainMarkdown(summary, index);
    await fs.writeFile(filePath, markdown, "utf8");
    generatedFiles.push(filePath);
  }

  return { domainsDir, generatedFiles: generatedFiles.sort() };
}

export async function analyzeContext(rootDir: string): Promise<AnalyzeResult> {
  const indexPath = path.join(
    rootDir,
    CODE_MEMORY_METADATA.contextPaths.aiDir,
    CODE_MEMORY_METADATA.contextPaths.contextIndexFile
  );
  const raw = await fs.readJSON(indexPath);
  const index = contextIndexSchema.parse(raw);
  const graphPath = path.join(
    rootDir,
    CODE_MEMORY_METADATA.contextPaths.aiDir,
    CODE_MEMORY_METADATA.contextPaths.dependencyGraphFile
  );
  const graph = (await fs.pathExists(graphPath)) ? dependencyGraphSchema.parse(await fs.readJSON(graphPath)) : undefined;
  const summaries = inferDomains(index, graph);
  const { domainsDir, generatedFiles } = await writeDomainArtifacts(rootDir, index, summaries);
  return { domainsDir, generatedFiles, summaries };
}

export { inferDomains, renderDomainMarkdown };
