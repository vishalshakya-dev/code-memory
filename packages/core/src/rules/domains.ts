export interface DomainRuleDefinition {
  domain: string;
  reason: string;
  pathPatterns: RegExp[];
  filenamePatterns: RegExp[];
  extensions: string[];
  frameworkFolders: RegExp[];
  configFiles: RegExp[];
  conceptKeywords: string[];
  minConfidence: number;
  minFiles?: number;
}

export const DOMAIN_RULE_DEFINITIONS: DomainRuleDefinition[] = [
  {
    domain: "frontend",
    reason: "UI pages/components and client-side behavior",
    pathPatterns: [/(^|\/)(frontend|client|web|ui|components|pages|app|views|templates|hooks)\//i, /(^|\/)integrations\/supabase\//i],
    filenamePatterns: [/(component|page|view|layout|screen)/i],
    extensions: [".tsx", ".jsx", ".vue", ".svelte", ".css", ".scss"],
    frameworkFolders: [/(^|\/)(components|pages|app)\//i],
    configFiles: [/(^|\/)vite\.config\./i, /(^|\/)next\.config\./i],
    conceptKeywords: ["dashboard"],
    minConfidence: 8
  },
  {
    domain: "backend",
    reason: "Server-side services and orchestration",
    pathPatterns: [/(^|\/)(server|backend|controllers?|services?|handlers?)\//i],
    filenamePatterns: [/(service|controller|handler|orchestr)/i],
    extensions: [".ts", ".js", ".py", ".php"],
    frameworkFolders: [/(^|\/)(api|routes?|routers?)\//i],
    configFiles: [/^$/],
    conceptKeywords: ["api"],
    minConfidence: 10
  },
  {
    domain: "database",
    reason: "Persistence layer including schemas and migrations",
    pathPatterns: [/(^|\/)(db|database|migrations|seeds|models|prisma|supabase)\//i],
    filenamePatterns: [/(schema|migration|model)/i],
    extensions: [".sql"],
    frameworkFolders: [/(^|\/)database\/migrations\//i],
    configFiles: [/(^|\/)prisma\/schema\.prisma$/i],
    conceptKeywords: ["database"],
    minConfidence: 9
  },
  {
    domain: "auth",
    reason: "Identity, sessions, and protected access",
    pathPatterns: [/(^|\/)(auth|authentication|login|session|signup|protected|user|providers?)\//i],
    filenamePatterns: [/(authmodal|protectedroute|useauth|login|session|signup|user|jwt|oauth|authprovider)/i],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".php"],
    frameworkFolders: [/(^|\/)(hooks|providers|routes|pages|components)\//i],
    configFiles: [/^$/],
    conceptKeywords: ["authentication"],
    minConfidence: 18,
    minFiles: 2
  },
  {
    domain: "admin",
    reason: "Admin and dashboard-focused surfaces",
    pathPatterns: [/(^|\/).*(admin|dashboard).*/i],
    filenamePatterns: [/(admin|dashboard|analytics)/i],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".py", ".php"],
    frameworkFolders: [/(^|\/)(pages|app|views|templates)\//i],
    configFiles: [/^$/],
    conceptKeywords: ["dashboard", "analytics"],
    minConfidence: 14
  },
  {
    domain: "integrations",
    reason: "External providers and webhooks",
    pathPatterns: [/(^|\/)(integrations?|providers?|adapters?|webhooks?)\//i],
    filenamePatterns: [/(webhook|callback|provider|integration)/i],
    extensions: [".ts", ".js", ".py", ".php"],
    frameworkFolders: [/(^|\/)(api|routes?|routers?)\//i],
    configFiles: [/^$/],
    conceptKeywords: ["webhook"],
    minConfidence: 14
  },
  {
    domain: "api",
    reason: "HTTP API boundaries",
    pathPatterns: [/(^|\/)(api|routes?|routers?)\//i],
    filenamePatterns: [/(api|route|router|controller|endpoint)/i],
    extensions: [".ts", ".js", ".py", ".php"],
    frameworkFolders: [/(^|\/)(app\/Http\/Controllers|routes)\//i],
    configFiles: [/(^|\/)routes\/api\.php$/i],
    conceptKeywords: ["api"],
    minConfidence: 10
  },
  {
    domain: "jobs",
    reason: "Background workers and scheduled tasks",
    pathPatterns: [/(^|\/)(jobs?|workers?|queue|cron|scheduler)\//i],
    filenamePatterns: [/(job|worker|queue|cron|schedule)/i],
    extensions: [".ts", ".js", ".py", ".php"],
    frameworkFolders: [/(^|\/)(jobs|workers)\//i],
    configFiles: [/^$/],
    conceptKeywords: ["jobs"],
    minConfidence: 10
  },
  {
    domain: "testing",
    reason: "Automated test suites",
    pathPatterns: [/(^|\/)(test|tests|__tests__|e2e)\//i],
    filenamePatterns: [/(test|spec|pytest|phpunit)/i],
    extensions: [".ts", ".js", ".py", ".php"],
    frameworkFolders: [/(^|\/)tests\//i],
    configFiles: [/(^|\/)(pytest\.ini|phpunit\.xml)$/i],
    conceptKeywords: ["testing"],
    minConfidence: 8
  },
  {
    domain: "docs",
    reason: "Documentation and project guides",
    pathPatterns: [/(^|\/)(docs|documentation)\//i],
    filenamePatterns: [/(readme|guide|architecture)/i],
    extensions: [".md"],
    frameworkFolders: [/(^|\/)docs\//i],
    configFiles: [/^$/],
    conceptKeywords: ["docs"],
    minConfidence: 6
  },
  {
    domain: "infrastructure",
    reason: "Runtime and deployment infrastructure",
    pathPatterns: [/(^|\/)(infra|infrastructure|deploy|k8s|helm|terraform|docker|supabase)\//i],
    filenamePatterns: [/(docker|compose|terraform|k8s|helm)/i],
    extensions: [".yml", ".yaml", ".tf"],
    frameworkFolders: [/(^|\/)\.github\//i],
    configFiles: [/(^|\/)(Dockerfile|docker-compose\.ya?ml|compose\.ya?ml)$/i],
    conceptKeywords: [],
    minConfidence: 8
  }
];
