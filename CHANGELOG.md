# Changelog

## 0.1.0 - 2026-05-09

Initial public MVP release.

### Added

- Monorepo with `code-memory-core` and `code-memory` CLI packages
- `code-memory init` for deterministic project context generation
- `code-memory analyze` for weighted domain inference
- `code-memory update` for incremental refresh based on git changes and state
- `code-memory relevant "<task>"` for compact relevance routing
- Lightweight regex-based dependency graph extraction for TS/JS, Python, and PHP
- `.ai/dependency-graph.json` generation
- Domain and stack rule system modules
- Test coverage for scanner, detector, analyzer, updater, relevant routing, and dependency graph

### Notes

- Deterministic static analysis only
- No AI APIs, embeddings, vector DB, or AST parser dependency
