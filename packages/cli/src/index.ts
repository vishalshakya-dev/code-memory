#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { CODE_MEMORY_METADATA, analyzeContext, findRelevantContext, initializeContext, updateContext } from "code-memory-core";

const program = new Command();

program
  .name(CODE_MEMORY_METADATA.cliName)
  .description(`${CODE_MEMORY_METADATA.appName} local-first context generator`)
  .version(CODE_MEMORY_METADATA.version);

program
  .command("init")
  .description("Scan current repository and generate .ai context artifacts")
  .action(async () => {
    const cwd = process.cwd();
    const result = await initializeContext(cwd);

    const root = path.resolve(cwd);
    console.log(`Context initialized for: ${root}`);
    console.log(`Scanned files: ${result.scanResult.files.length}`);
    console.log(`Detected kinds: ${result.detection.projectKinds.join(", ")}`);
    console.log(`Wrote: ${result.markdownPath}`);
    console.log(`Wrote: ${result.indexPath}`);
  });

program
  .command("analyze")
  .description("Read .ai/context-index.json and generate domain context files")
  .action(async () => {
    const cwd = process.cwd();
    const result = await analyzeContext(cwd);

    const root = path.resolve(cwd);
    console.log(`Context analyzed for: ${root}`);
    console.log(`Domains directory: ${result.domainsDir}`);
    console.log(`Generated domain files: ${result.generatedFiles.length}`);
    for (const file of result.generatedFiles) {
      console.log(`Wrote: ${file}`);
    }
  });

program
  .command("update")
  .description("Incrementally update context artifacts using git-changed files and saved state")
  .action(async () => {
    const cwd = process.cwd();
    const result = await updateContext(cwd);

    if (result.upToDate) {
      console.log(CODE_MEMORY_METADATA.generatedText.upToDateMessage);
      return;
    }

    const root = path.resolve(cwd);
    console.log(`Context updated for: ${root}`);
    console.log(`Git changed files: ${result.changedFiles.length}`);
    console.log(`Meaningful changes: ${result.meaningfulChangedFiles.length}`);
    console.log(`Wrote: ${result.markdownPath}`);
    console.log(`Wrote: ${result.indexPath}`);
    console.log(`Wrote: ${result.statePath}`);
    for (const file of result.generatedDomainFiles) {
      console.log(`Wrote: ${file}`);
    }
    for (const file of result.removedDomainFiles) {
      console.log(`Removed: ${file}`);
    }
  });

program
  .command("relevant")
  .description("Find relevant domains and files for a task from generated context")
  .argument("<task>", "Task description, e.g. \"fix authentication bug\"")
  .action(async (task: string) => {
    const cwd = process.cwd();
    const result = await findRelevantContext(cwd, task);
    const warnings = result.warnings ?? [];
    const suggestions = result.suggestions ?? [];
    const noStrongMatch = result.noStrongMatch ?? false;

    console.log(`Task: ${result.task}`);
    for (const warning of warnings) console.log(`Warning: ${warning}`);
    if (noStrongMatch) {
      console.log("No strong match found");
      for (const suggestion of suggestions) console.log(`Suggestion: ${suggestion}`);
      return;
    }
    console.log(`Relevant domains: ${result.domains.join(", ") || "(none)"}`);
    console.log("Top relevant files:");
    if (result.topFiles.length === 0) console.log("- (none)");
    for (const file of result.topFiles) console.log(`- ${file}`);
    console.log("Important entry points:");
    if (result.entryPoints.length === 0) console.log("- (none)");
    for (const entry of result.entryPoints) console.log(`- ${entry}`);
    console.log("Detected concepts:");
    if (result.concepts.length === 0) console.log("- (none)");
    for (const concept of result.concepts) console.log(`- ${concept}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`${CODE_MEMORY_METADATA.cliName} failed: ${message}`);
  process.exitCode = 1;
});
