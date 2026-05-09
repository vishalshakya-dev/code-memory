import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { buildDependencyGraph } from "../src/dependency-graph.js";

const tempDirs: string[] = [];

async function mk(structure: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-memory-graph-"));
  tempDirs.push(root);
  for (const [file, content] of Object.entries(structure)) {
    await fs.ensureFile(path.join(root, file));
    await fs.writeFile(path.join(root, file), content, "utf8");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((d) => fs.remove(d)));
  tempDirs.length = 0;
});

describe("buildDependencyGraph", () => {
  it("extracts TypeScript/JavaScript imports and requires", async () => {
    const root = await mk({
      "src/a.ts": `import { b } from "./b"; const c = require("./c");`,
      "src/b.ts": `export const b = 1;`,
      "src/c.ts": `export const c = 2;`
    });
    const graph = await buildDependencyGraph(root, ["src/a.ts", "src/b.ts", "src/c.ts"]);
    expect(graph.nodes["src/a.ts"]).toEqual(["src/b.ts", "src/c.ts"]);
  });

  it("extracts Python imports", async () => {
    const root = await mk({
      "app/main.py": `from app.routers import auth\nimport app.models.user`,
      "app/routers/auth.py": `x = 1`,
      "app/models/user.py": `y = 2`
    });
    const graph = await buildDependencyGraph(root, ["app/main.py", "app/routers/auth.py", "app/models/user.py"]);
    expect(graph.nodes["app/main.py"]).toEqual(["app/models/user.py", "app/routers/auth.py"]);
  });

  it("extracts PHP require/use references", async () => {
    const root = await mk({
      "app/Http/Controllers/AuthController.php":
        `<?php require_once "../Models/User.php"; use App\\Services\\SessionService;`,
      "app/Http/Models/User.php": `<?php`,
      "App/Services/SessionService.php": `<?php`
    });
    const graph = await buildDependencyGraph(root, [
      "app/Http/Controllers/AuthController.php",
      "app/Http/Models/User.php",
      "App/Services/SessionService.php"
    ]);
    expect(graph.nodes["app/Http/Controllers/AuthController.php"]).toContain("App/Services/SessionService.php");
  });
});
