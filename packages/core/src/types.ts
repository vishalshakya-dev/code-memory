export const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/vendor/**",
  "**/coverage/**"
] as const;

export type ProjectSignal =
  | "has-package-json"
  | "has-tsconfig"
  | "has-vite-config"
  | "has-supabase"
  | "has-prisma"
  | "has-dockerfile"
  | "has-docker-compose";

export interface ScanResult {
  rootDir: string;
  files: string[];
  ignored: string[];
}

export interface ProjectDetection {
  signals: ProjectSignal[];
  projectKinds: string[];
}

export interface InitResult {
  markdownPath: string;
  indexPath: string;
  scanResult: ScanResult;
  detection: ProjectDetection;
}

export interface DomainSummary {
  domain: string;
  reason: string;
  files: string[];
  allFiles?: string[];
}

export interface AnalyzeResult {
  domainsDir: string;
  generatedFiles: string[];
  summaries: DomainSummary[];
}

export interface UpdateResult {
  upToDate: boolean;
  changedFiles: string[];
  meaningfulChangedFiles: string[];
  markdownPath: string;
  indexPath: string;
  statePath: string;
  generatedDomainFiles: string[];
  removedDomainFiles: string[];
}

export interface RelevantResult {
  task: string;
  domains: string[];
  topFiles: string[];
  entryPoints: string[];
  concepts: string[];
}
