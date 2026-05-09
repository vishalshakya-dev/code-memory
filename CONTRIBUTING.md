# Contributing to CodeMemory

Thanks for contributing.

## Development Setup

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Workflow

1. Create a focused branch.
2. Keep changes deterministic and minimal.
3. Add or update tests for behavior changes.
4. Run build, tests, and typecheck before opening a PR.

## Coding Guidelines

- Prefer simple, modular code.
- Keep CLI output compact and high-signal.
- Avoid machine-specific paths and environment assumptions.
- Do not add AI API or cloud dependencies to core deterministic flows.

## Pull Request Checklist

- [ ] Tests added/updated
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] README/docs updated when behavior changes

## Reporting Issues

Please include:

- CodeMemory version
- command used
- expected vs actual behavior
- minimal reproduction
