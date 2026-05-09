export interface EntryPointRule {
  domain: string;
  patterns: RegExp[];
}

export const ENTRYPOINT_RULES: EntryPointRule[] = [
  {
    domain: "auth",
    patterns: [
      /(^|\/)(hooks\/useAuth|providers?\/.*auth|routes?\/.*protected|pages?\/.*(login|signup|auth)|components?\/.*(AuthModal|ProtectedRoute)|api\/.*auth).*?\.(ts|tsx|js|jsx|py|php)$/i
    ]
  },
  {
    domain: "api",
    patterns: [/(^|\/)(api|routes?|routers?)\/.+\.(ts|tsx|js|jsx|py|php)$/i]
  },
  {
    domain: "jobs",
    patterns: [/(^|\/)(jobs?|workers?|queue|cron|scheduler)\//i]
  },
  {
    domain: "admin",
    patterns: [/(^|\/)(pages|app|views|templates)\/.*(admin|dashboard).*\.(ts|tsx|js|jsx|py|php)$/i]
  },
  {
    domain: "backend",
    patterns: [/(^|\/)(controllers?|services?|handlers?|routes?|routers?)\//i]
  },
  {
    domain: "frontend",
    patterns: [/(^|\/)(pages|app|components)\//i, /\.(tsx|jsx|vue|svelte)$/i]
  }
];

const GENERIC_ENTRY_POINT_PATTERNS = [
  /(^|\/)(index|main|app|server|client|entry|router|routes?)\.(ts|tsx|js|jsx|py|php)$/i,
  /(^|\/)(manage\.py|artisan|routes\/web\.php|routes\/api\.php)$/i
];

export function inferEntryPoints(files: string[], domain?: string): string[] {
  const patterns = domain
    ? ENTRYPOINT_RULES.find((r) => r.domain === domain)?.patterns ?? GENERIC_ENTRY_POINT_PATTERNS
    : GENERIC_ENTRY_POINT_PATTERNS;
  return files.filter((f) => patterns.some((p) => p.test(f))).slice(0, domain === "auth" ? 8 : 6);
}
