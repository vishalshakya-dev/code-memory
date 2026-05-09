export interface ConceptRule {
  concept: string;
  pattern: RegExp;
  strongPattern: RegExp;
}

export const CONCEPT_RULES: ConceptRule[] = [
  {
    concept: "authentication",
    pattern: /(auth|login|logout|session|signup|jwt|oauth|protected)/i,
    strongPattern: /(^|\/)(auth|authentication|login|logout|session|signup|protected|oauth|jwt)(\/|\.|$)|\b(useAuth|AuthProvider|ProtectedRoute)\b/i
  },
  {
    concept: "dashboard",
    pattern: /(dashboard|admin)/i,
    strongPattern: /(^|\/)(dashboard|admin)(\/|\.|$)|\b(adminDashboard|dashboardPage)\b/i
  },
  {
    concept: "analytics",
    pattern: /(analytics|metrics|tracking|events)/i,
    strongPattern: /(^|\/)(analytics|metrics|tracking|events)(\/|\.|$)|\b(eventTracker|metricsService)\b/i
  },
  {
    concept: "webhook",
    pattern: /(webhook|callback|provider|integration)/i,
    strongPattern: /(^|\/)(webhook|callback|provider|integration)(\/|\.|$)|\b(webhookHandler|providerAdapter)\b/i
  },
  {
    concept: "jobs",
    pattern: /(queue|worker|job|cron|scheduler)/i,
    strongPattern: /(^|\/)(queue|worker|job|jobs|cron|scheduler)(\/|\.|$)|\b(jobRunner|taskScheduler)\b/i
  },
  {
    concept: "database",
    pattern: /(prisma|migrations?|models?|schema|sql|orm)/i,
    strongPattern: /(^|\/)(prisma|migrations?|models?|schema|database|db)(\/|\.|$)|\b(schema\.prisma|migration)\b/i
  },
  {
    concept: "api",
    pattern: /(api|router|routes?|controller|endpoint)/i,
    strongPattern: /(^|\/)(api|router|routes?|controller)(\/|\.|$)|\b(endpoint|requestHandler)\b/i
  },
  {
    concept: "testing",
    pattern: /(test|spec|e2e|pytest|phpunit)/i,
    strongPattern: /(^|\/)(test|tests|spec|e2e)(\/|\.|$)|\b(test_|spec\.)/i
  },
  {
    concept: "docs",
    pattern: /(readme|docs|guide|architecture)/i,
    strongPattern: /(^|\/)(docs?|readme|architecture|guide)(\/|\.|$)/i
  }
];

export interface ConceptDetectionOptions {
  requireStrongSupport?: boolean;
}

export function detectConcepts(files: string[], options: ConceptDetectionOptions = {}): string[] {
  const requireStrongSupport = options.requireStrongSupport ?? false;
  const found = CONCEPT_RULES.filter((rule) => {
    const matchedFiles = files.filter((f) => rule.pattern.test(f));
    if (matchedFiles.length === 0) return false;
    if (!requireStrongSupport) return true;
    return matchedFiles.some((f) => rule.strongPattern.test(f));
  }).map((rule) => rule.concept);
  return found.sort();
}
