import fs from "node:fs/promises";
import path from "node:path";

const restore = process.argv.includes("--restore");
const cliDir = process.cwd();
const cliPackagePath = path.join(cliDir, "package.json");
const backupPath = path.join(cliDir, ".package.json.release-backup");
const corePackagePath = path.resolve(cliDir, "../core/package.json");

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

if (restore) {
  const backup = await fs.readFile(backupPath, "utf8").catch(() => null);
  if (backup) {
    await fs.writeFile(cliPackagePath, backup, "utf8");
    await fs.rm(backupPath, { force: true });
  }
  process.exit(0);
}

const [cliRaw, coreRaw] = await Promise.all([
  fs.readFile(cliPackagePath, "utf8"),
  fs.readFile(corePackagePath, "utf8")
]);

const cliPackage = JSON.parse(cliRaw);
const corePackage = JSON.parse(coreRaw);
const workspaceDependency = cliPackage.dependencies?.["code-memory-core"];
if (typeof workspaceDependency !== "string" || !workspaceDependency.startsWith("workspace:")) {
  process.exit(0);
}

await fs.writeFile(backupPath, cliRaw, "utf8");
cliPackage.dependencies["code-memory-core"] = `^${corePackage.version}`;
await writeJson(cliPackagePath, cliPackage);
