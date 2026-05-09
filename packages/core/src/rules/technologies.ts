import type { ContextIndex } from "../schema.js";

export interface TechnologyRule {
  technology: string;
  patterns: RegExp[];
}

export const TECHNOLOGY_RULES: TechnologyRule[] = [
  { technology: "React", patterns: [/\.(tsx|jsx)$/i, /(^|\/)(components|hooks|pages|app)\//i] },
  { technology: "Vite", patterns: [/(^|\/)vite\.config\./i] },
  { technology: "Next.js", patterns: [/(^|\/)next\.config\./i, /(^|\/)app\//i] },
  { technology: "Node.js", patterns: [/(^|\/)package\.json$/i] },
  { technology: "Express", patterns: [/(^|\/)(routes|controllers)\//i] },
  { technology: "NestJS", patterns: [/(^|\/)(main|app)\.module\.ts$/i] },
  { technology: "Python", patterns: [/(^|\/)(pyproject\.toml|requirements\.txt|setup\.py)$/i, /\.py$/i] },
  { technology: "FastAPI", patterns: [/(^|\/)(routers|api)\//i, /(fastapi)/i] },
  { technology: "Django", patterns: [/(^|\/)manage\.py$/i, /(wsgi\.py|asgi\.py)/i] },
  { technology: "Flask", patterns: [/(flask)/i] },
  { technology: "PHP", patterns: [/(^|\/)composer\.json$/i, /\.php$/i] },
  { technology: "Laravel", patterns: [/(^|\/)artisan$/i, /(^|\/)app\/Http\/Controllers\//i, /(^|\/)routes\/web\.php$/i] },
  { technology: "Supabase", patterns: [/(^|\/)supabase\//i] },
  { technology: "Docker", patterns: [/(^|\/)Dockerfile$/i, /(docker-compose|compose)\.ya?ml$/i] },
  { technology: "Prisma", patterns: [/(^|\/)prisma\/schema\.prisma$/i] }
];

export function detectTechnologies(index: ContextIndex, files: string[], stacks: string[]): string[] {
  const tech = new Set<string>();
  const all = files.join("\n");

  if (index.signals.includes("has-tsconfig")) tech.add("TypeScript");
  if (index.signals.includes("has-prisma") || index.signals.includes("has-supabase")) tech.add("Database Access");
  for (const rule of TECHNOLOGY_RULES) {
    if (rule.patterns.some((p) => p.test(all))) tech.add(rule.technology);
  }
  for (const stack of stacks) {
    if (stack === "nextjs") tech.add("Next.js");
    if (stack === "nestjs") tech.add("NestJS");
    if (stack === "fastapi") tech.add("FastAPI");
  }

  if (/(^|\/)hooks\//im.test(all) || /use[A-Z][A-Za-z0-9]+\.tsx?$/im.test(all)) tech.add("React Hooks");
  if (/(^|\/)pages\//im.test(all)) tech.add("Pages Routing");
  if (/(^|\/)components\//im.test(all)) tech.add("UI Components");
  if (/supabase/i.test(all)) tech.add("Supabase Integration");
  if (/(^|\/)(api|server|backend|services|controllers|routes|routers)\//im.test(all)) tech.add("API Services");
  if (/(prisma|schema\.prisma|migrations|\.sql|database\/migrations|models?\/)/im.test(all)) tech.add("Database Access");
  if (/(integrations|providers|adapters|webhook|stripe|slack|s3|callback)/im.test(all)) tech.add("External Integrations");
  if (/(orchestr|workflow|job|queue|service|worker|scheduler|cron)/im.test(all)) tech.add("Service Orchestration");

  return [...tech].sort();
}
