export interface StackRule {
  stack: string;
  patterns: RegExp[];
  minScore: number;
}

export const STACK_RULES: StackRule[] = [
  { stack: "react", patterns: [/\.(tsx|jsx)$/i, /(^|\/)(components|hooks|pages|app)\//i], minScore: 2 },
  { stack: "vite", patterns: [/(^|\/)vite\.config\./i], minScore: 1 },
  { stack: "nextjs", patterns: [/(^|\/)next\.config\./i, /(^|\/)app\//i], minScore: 1 },
  { stack: "node", patterns: [/(^|\/)package\.json$/i, /\.(ts|js|mjs|cjs)$/i], minScore: 2 },
  { stack: "express", patterns: [/(express|router\.|app\.use\()/i, /(^|\/)(routes|controllers)\//i], minScore: 1 },
  { stack: "nestjs", patterns: [/(^|\/)(main|app)\.module\.ts$/i, /@nestjs\//i], minScore: 1 },
  { stack: "python", patterns: [/(^|\/)(pyproject\.toml|requirements\.txt|setup\.py)$/i, /\.py$/i], minScore: 2 },
  { stack: "fastapi", patterns: [/(fastapi|uvicorn)/i, /(^|\/)(routers|api)\//i], minScore: 1 },
  { stack: "django", patterns: [/(^|\/)manage\.py$/i, /(django|wsgi\.py|asgi\.py)/i], minScore: 1 },
  { stack: "flask", patterns: [/(flask|gunicorn)/i, /(^|\/)(app|api)\.py$/i], minScore: 1 },
  { stack: "php", patterns: [/(^|\/)composer\.json$/i, /\.php$/i], minScore: 2 },
  {
    stack: "laravel",
    patterns: [
      /(^|\/)artisan$/i,
      /(^|\/)app\/Http\/Controllers\//i,
      /(^|\/)app\/Models\//i,
      /(^|\/)routes\/(web|api)\.php$/i,
      /(^|\/)database\/migrations\//i
    ],
    minScore: 2
  },
  { stack: "supabase", patterns: [/(^|\/)supabase\//i], minScore: 1 },
  { stack: "docker", patterns: [/(^|\/)Dockerfile$/i, /(docker-compose|compose)\.ya?ml$/i], minScore: 1 }
];

export function detectStacks(files: string[]): string[] {
  const detected: string[] = [];
  for (const rule of STACK_RULES) {
    const score = rule.patterns.reduce((acc, p) => acc + (files.some((f) => p.test(f)) ? 1 : 0), 0);
    if (score >= rule.minScore) detected.push(rule.stack);
  }
  return detected.sort();
}
