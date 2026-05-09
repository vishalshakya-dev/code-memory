export interface ConceptRule {
  concept: string;
  pattern: RegExp;
}

export const CONCEPT_RULES: ConceptRule[] = [
  { concept: "authentication", pattern: /(auth|login|logout|session|signup|jwt|oauth|protected)/i },
  { concept: "dashboard", pattern: /(dashboard|admin)/i },
  { concept: "analytics", pattern: /(analytics|metrics|tracking|events)/i },
  { concept: "webhook", pattern: /(webhook|callback|provider|integration)/i },
  { concept: "jobs", pattern: /(queue|worker|job|cron|scheduler)/i },
  { concept: "database", pattern: /(prisma|migrations?|models?|schema|sql|orm)/i },
  { concept: "api", pattern: /(api|router|routes?|controller|endpoint)/i },
  { concept: "testing", pattern: /(test|spec|e2e|pytest|phpunit)/i },
  { concept: "docs", pattern: /(readme|docs|guide|architecture)/i }
];

export function detectConcepts(files: string[]): string[] {
  const found = CONCEPT_RULES.filter((rule) => files.some((f) => rule.pattern.test(f))).map((rule) => rule.concept);
  return found.sort();
}
