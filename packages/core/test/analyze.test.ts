import path from "node:path";
import os from "node:os";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";
import { analyzeContext, inferDomains } from "../src/analyze.js";
import { type ContextIndex, type DependencyGraph } from "../src/schema.js";
import { getDomainFooter } from "../src/metadata.js";

const tempDirs: string[] = [];

function sampleIndex(rootDir: string): ContextIndex {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-08T00:00:00.000Z",
    rootDir,
    ignored: [],
    scannedFileCount: 9,
    signals: ["has-package-json", "has-prisma", "has-supabase"],
    projectKinds: ["node", "prisma", "supabase"],
    categories: {
      configs: ["package.json"],
      source: [
        "src/auth/session.ts",
        "src/hooks/useAuth.ts",
        "src/components/Button.tsx",
        "src/pages/dashboard.tsx",
        "src/integrations/supabase/client.ts",
        "src/api/users.ts",
        "src/api/integrations/slack.ts",
        "src/services/orchestrator.ts",
        "prisma/schema.prisma"
      ],
      tests: ["tests/auth.test.ts"],
      docs: ["README.md"],
      infra: ["docker-compose.yml"]
    }
  };
}

async function makeRootWithIndex(index: ContextIndex): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "code-memory-analyze-"));
  tempDirs.push(root);
  await fs.ensureDir(path.join(root, ".ai"));
  await fs.writeJSON(path.join(root, ".ai", "context-index.json"), index, { spaces: 2 });
  return root;
}

afterEach(async () => {
  await Promise.all(tempDirs.map((d) => fs.remove(d)));
  tempDirs.length = 0;
});

describe("inferDomains", () => {
  it("infers common domains from deterministic path patterns", () => {
    const index = sampleIndex("/tmp/project");
    const domains = inferDomains(index);
    const names = domains.map((d) => d.domain);

    expect(names).toContain("auth");
    expect(names).toContain("frontend");
    expect(names).toContain("database");
    expect(names).toContain("backend");
  });

  it("limits each domain file list to top 15 relevant files", () => {
    const rootDir = "/tmp/project";
    const source = Array.from({ length: 30 }, (_, i) => `src/frontend/components/Comp${i}.tsx`);
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir,
      ignored: [],
      scannedFileCount: source.length,
      signals: ["has-package-json", "has-tsconfig"],
      projectKinds: ["node", "typescript"],
      categories: { configs: [], source, tests: [], docs: [], infra: [] }
    };
    const domains = inferDomains(index);
    const frontend = domains.find((d) => d.domain === "frontend");
    expect(frontend).toBeDefined();
    expect(frontend?.files.length).toBe(15);
  });

  it("creates auth domain from repeated auth concepts beyond folder-only structure", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/project",
      ignored: [],
      scannedFileCount: 8,
      signals: ["has-package-json"],
      projectKinds: ["node"],
      categories: {
        configs: [],
        source: [
          "src/features/userLogin.ts",
          "src/handlers/sessionManager.ts",
          "src/routes/protectedRoute.ts",
          "src/services/userAccessService.ts",
          "src/lib/jwtToken.ts",
          "src/api/userSession.ts"
        ],
        tests: ["tests/session.test.ts"],
        docs: [],
        infra: []
      }
    };
    const domains = inferDomains(index);
    const names = domains.map((d) => d.domain);
    expect(names).toContain("auth");
  });

  it("groups webhook-heavy files into integrations domain", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/project",
      ignored: [],
      scannedFileCount: 6,
      signals: ["has-package-json"],
      projectKinds: ["node"],
      categories: {
        configs: [],
        source: [
          "src/api/paymentWebhook.ts",
          "src/internal/providerAdapter.ts",
          "src/notify/webhookDispatcher.ts",
          "src/services/integrationSync.ts",
          "src/handlers/providerCallback.ts"
        ],
        tests: [],
        docs: [],
        infra: []
      }
    };
    const domains = inferDomains(index);
    expect(domains.map((d) => d.domain)).toContain("integrations");
  });

  it("groups dashboard/admin signals into admin domain", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/project",
      ignored: [],
      scannedFileCount: 6,
      signals: ["has-package-json", "has-tsconfig"],
      projectKinds: ["node", "typescript"],
      categories: {
        configs: [],
        source: [
          "src/views/dashboardHome.tsx",
          "src/widgets/adminPanel.tsx",
          "src/state/adminAnalytics.ts",
          "src/pages/dashboardSettings.tsx",
          "src/ui/adminStatsCard.tsx"
        ],
        tests: [],
        docs: [],
        infra: []
      }
    };
    const domains = inferDomains(index);
    expect(domains.map((d) => d.domain)).toContain("admin");
  });

  it("detects laravel-style backend/api/database domains", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/laravel",
      ignored: [],
      scannedFileCount: 8,
      signals: [],
      projectKinds: ["generic"],
      categories: {
        configs: ["composer.json", "artisan", "routes/web.php", "routes/api.php"],
        source: ["app/Http/Controllers/AuthController.php", "app/Models/User.php"],
        tests: [],
        docs: [],
        infra: ["database/migrations/2024_01_01_create_users_table.php"]
      }
    };
    const domains = inferDomains(index).map((d) => d.domain);
    expect(domains).toContain("backend");
    expect(domains).toContain("api");
    expect(domains).toContain("database");
  });

  it("detects python fastapi-style api/backend domains", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/python",
      ignored: [],
      scannedFileCount: 8,
      signals: [],
      projectKinds: ["generic"],
      categories: {
        configs: ["pyproject.toml", "requirements.txt", "manage.py"],
        source: ["app/main.py", "api/routers/auth.py", "src/models/user.py", "migrations/001_init.py"],
        tests: ["tests/test_auth.py"],
        docs: [],
        infra: []
      }
    };
    const domains = inferDomains(index).map((d) => d.domain);
    expect(domains).toContain("backend");
    expect(domains).toContain("api");
    expect(domains).toContain("database");
  });

  it("handles mixed repositories with multiple stacks", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/mixed",
      ignored: [],
      scannedFileCount: 12,
      signals: ["has-package-json", "has-vite-config"],
      projectKinds: ["node", "vite"],
      categories: {
        configs: ["package.json", "vite.config.ts", "pyproject.toml", "composer.json"],
        source: [
          "src/components/App.tsx",
          "api/routes/user.ts",
          "app/Http/Controllers/UserController.php",
          "src_python/routers/auth.py"
        ],
        tests: ["tests/user.test.ts", "tests/test_auth.py"],
        docs: ["README.md"],
        infra: ["Dockerfile", "docker-compose.yml"]
      }
    };
    const domains = inferDomains(index).map((d) => d.domain);
    expect(domains).toContain("frontend");
    expect(domains).toContain("backend");
    expect(domains).toContain("api");
    expect(domains).toContain("infrastructure");
  });

  it("does not emit duplicate domain entries", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/dup-check",
      ignored: [],
      scannedFileCount: 6,
      signals: ["has-package-json"],
      projectKinds: ["node"],
      categories: {
        configs: [],
        source: [
          "src/auth/useAuth.ts",
          "src/routes/ProtectedRoute.tsx",
          "src/pages/login.tsx",
          "src/services/authService.ts"
        ],
        tests: [],
        docs: [],
        infra: []
      }
    };
    const domains = inferDomains(index).map((d) => d.domain);
    const unique = new Set(domains);
    expect(domains.length).toBe(unique.size);
    expect(domains).toContain("auth");
  });

  it("strengthens integrations/auth domains with dependency graph connections", () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/dep-strength",
      ignored: [],
      scannedFileCount: 5,
      signals: ["has-package-json"],
      projectKinds: ["node"],
      categories: {
        configs: [],
        source: [
          "src/routes/ProtectedRoute.tsx",
          "src/hooks/useAuth.ts",
          "src/integrations/webhookHandler.ts",
          "src/services/providerClient.ts"
        ],
        tests: [],
        docs: [],
        infra: []
      }
    };
    const graph: DependencyGraph = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/dep-strength",
      nodes: {
        "src/routes/ProtectedRoute.tsx": ["src/hooks/useAuth.ts"],
        "src/hooks/useAuth.ts": ["src/routes/ProtectedRoute.tsx"],
        "src/integrations/webhookHandler.ts": ["src/services/providerClient.ts"],
        "src/services/providerClient.ts": ["src/integrations/webhookHandler.ts"]
      }
    };
    const domains = inferDomains(index, graph).map((d) => d.domain);
    expect(domains).toContain("auth");
    expect(domains).toContain("integrations");
  });
});

describe("analyzeContext", () => {
  it("generates one markdown file per inferred domain", async () => {
    const index = sampleIndex("/tmp/project");
    const root = await makeRootWithIndex(index);
    const result = await analyzeContext(root);

    expect(result.generatedFiles.length).toBeGreaterThanOrEqual(4);

    const authFile = path.join(root, ".ai", "domains", "auth.md");
    const frontendFile = path.join(root, ".ai", "domains", "frontend.md");
    const databaseFile = path.join(root, ".ai", "domains", "database.md");

    expect(await fs.pathExists(authFile)).toBe(true);
    expect(await fs.pathExists(frontendFile)).toBe(true);
    expect(await fs.pathExists(databaseFile)).toBe(true);

    const authContent = await fs.readFile(authFile, "utf8");
    expect(authContent).toContain("src/auth/session.ts");
    expect(authContent).toContain("## Purpose");
    expect(authContent).toContain("## Detected Concepts");
    expect(authContent).toContain(getDomainFooter());

    const frontendContent = await fs.readFile(frontendFile, "utf8");
    expect(frontendContent).toContain("React");
    expect(frontendContent).toContain("React Hooks");
    expect(frontendContent).toContain("Pages Routing");
    expect(frontendContent).toContain("UI Components");
    expect(frontendContent).toContain("Supabase Integration");

    const backendFile = path.join(root, ".ai", "domains", "backend.md");
    const backendContent = await fs.readFile(backendFile, "utf8");
    expect(backendContent).toContain("API Services");
    expect(backendContent).toContain("Database Access");
    expect(backendContent).toContain("External Integrations");
    expect(backendContent).toContain("Service Orchestration");
  });

  it("falls back to general domain when no rules match", async () => {
    const rootDir = "/tmp/no-match";
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir,
      ignored: [],
      scannedFileCount: 1,
      signals: [],
      projectKinds: ["generic"],
      categories: {
        configs: [],
        source: ["misc/file.unknown"],
        tests: [],
        docs: [],
        infra: []
      }
    };
    const root = await makeRootWithIndex(index);
    const result = await analyzeContext(root);
    expect(result.summaries.map((s) => s.domain)).toEqual(["general"]);
    expect(await fs.pathExists(path.join(root, ".ai", "domains", "general.md"))).toBe(true);
  });

  it("generates auth.md for React auth flows with auth entry points", async () => {
    const index: ContextIndex = {
      schemaVersion: 1,
      generatedAt: "2026-05-08T00:00:00.000Z",
      rootDir: "/tmp/react-auth",
      ignored: [],
      scannedFileCount: 10,
      signals: ["has-package-json", "has-tsconfig"],
      projectKinds: ["node", "typescript"],
      categories: {
        configs: [],
        source: [
          "src/hooks/useAuth.ts",
          "src/providers/AuthProvider.tsx",
          "src/routes/ProtectedRoute.tsx",
          "src/components/AuthModal.tsx",
          "src/pages/login.tsx",
          "src/pages/signup.tsx",
          "src/lib/jwt.ts",
          "src/services/userSession.ts"
        ],
        tests: [],
        docs: [],
        infra: []
      }
    };
    const root = await makeRootWithIndex(index);
    const result = await analyzeContext(root);
    expect(result.summaries.map((s) => s.domain)).toContain("auth");

    const authFile = path.join(root, ".ai", "domains", "auth.md");
    expect(await fs.pathExists(authFile)).toBe(true);
    const content = await fs.readFile(authFile, "utf8");
    expect(content).toContain("src/hooks/useAuth.ts");
    expect(content).toContain("src/providers/AuthProvider.tsx");
    expect(content).toContain("src/routes/ProtectedRoute.tsx");
    expect(content).toContain("src/components/AuthModal.tsx");
  });
});
