import { z } from "zod";

export const contextIndexSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  rootDir: z.string(),
  ignored: z.array(z.string()),
  scannedFileCount: z.number().int().nonnegative(),
  signals: z.array(z.string()),
  projectKinds: z.array(z.string()),
  categories: z.object({
    configs: z.array(z.string()),
    source: z.array(z.string()),
    tests: z.array(z.string()),
    docs: z.array(z.string()),
    infra: z.array(z.string())
  })
});

export type ContextIndex = z.infer<typeof contextIndexSchema>;

export const contextStateSchema = z.object({
  schemaVersion: z.literal(1),
  rootDir: z.string(),
  lastAnalyzedAt: z.string(),
  generatedDomains: z.array(z.string()),
  fileHashes: z.record(z.string(), z.string())
});

export type ContextState = z.infer<typeof contextStateSchema>;

export const dependencyGraphSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  rootDir: z.string(),
  nodes: z.record(z.string(), z.array(z.string()))
});

export type DependencyGraph = z.infer<typeof dependencyGraphSchema>;
