# Changelog

All notable changes to `@orgsdk/plugins` are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/) and uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Reusable GitHub workflows** for plugin repositories — centrally maintained
  CI and catalog-publish pipelines that consumers call with `uses:` instead of
  duplicating mechanics:
  - `plugin-ci.yml` (`workflow_call`) — checkout (full history), frozen
    install, version guard, lint, typecheck, tests, validate, package, and
    artifact upload. Invokes only the caller's `bun run` scripts.
  - `plugin-publish.yml` (`workflow_call`) — self-contained build + validated
    catalog publish via the `orgsdk-plugin` CLI. Dry-run by default; a real
    publish requires an explicit opt-in gate (`publish-enabled`), the
    `ORGSDK_PUBLISH_TOKEN` secret, and a configured catalog URL. Serialized per
    caller repo+ref with `cancel-in-progress: false`.
  - Both use SHA-pinned third-party actions, least-privilege
    `permissions: contents: read`, `--frozen-lockfile`, and `fetch-depth: 0`
    for the version guard.
- **Static workflow guard** (`tests/workflows.test.ts`, `bun run
  workflows:check`) asserting SHA-pinning, least-privilege permissions, frozen
  installs, full history, serialized non-cancelled publication, and that the
  publish token is never echoed.
- **Reusable-workflow docs** (`docs/reusable-workflows.md`) with the minimal
  caller workflow, one-time setup table, opt-in/dry-run truth table, and exact
  template/Serper caller examples.

## [0.2.0] — 2026-07-15

### Added
- **`orgsdk-plugin` CLI** (`src/cli.ts`) with four author commands plus a
  schema generator:
  - `validate` — manifest, entry-point, and source-isolation validation using
    the canonical Zod schema.
  - `package` — deterministic artifact staging, runtime-dependency capture,
    checksum manifest, and tarball (no shell injection; sorted traversal).
  - `version-guard` — package/manifest version sync + content-change bump gate.
  - `publish` — dry-run by default; authenticated catalog publication that
    never logs tokens and reports version conflicts clearly.
  - `generate-schema` — regenerates the committed JSON Schema from Zod.
  - Global `--root` (default: cwd) and `--plugin-dir` (default: `<root>/plugin`)
    options for local and CI automation.
- **Reusable library modules** (`src/sdk/`) beneath the CLI so tests and
  internal tools call functions directly instead of spawning scripts:
  `validatePlugin`, `packagePlugin`, `versionGuard`, `publishPlugin`, plus
  deterministic filesystem and safe git helpers.
- **Canonical author manifest schema.** The Zod schema is now the single source
  of truth: the public `AuthorManifest` / `PluginManifest` TypeScript type is
  inferred from it, and the published JSON Schema is generated from it.
  - Explicit, typed `marketplace` metadata (replaces free-form
    `Record<string, unknown>`).
  - `$schema` field validated against the canonical URL.
  - Strict top-level shape: unknown keys are rejected so typos surface locally.
  - Reserved runtime-enriched fields (`dependencies`, `bundled`) are rejected
    with a targeted message (`RESERVED_RUNTIME_FIELDS`).
  - Semver validation on `version`.
  - Every field carries a description for generated editor hints.
- **Committed JSON Schema** `schemas/plugin-manifest.v1.json` (Draft 2020-12,
  generated from Zod 4 via `z.toJSONSchema`). Branded `$id`
  `https://orgsdk.ai/schemas/plugin-manifest.v1.json`. Shipped in the npm
  package and exposed via `./schema/plugin-manifest.v1.json`.
- **Schema drift guard** — `checkSchemaDrift()` + `tests/schema-drift.test.ts`
  fail loudly when the committed schema and Zod source diverge.
- `generate-schema` package script and `orgsdk-plugin generate-schema` command.
- Comprehensive test suite: manifest schema, schema drift, validate, package
  (determinism, stale-file removal, runtime deps), version-guard, publish
  (dry-run safety, token redaction, payload), and CLI smoke tests.

### Changed
- `PluginManifest` is now inferred from the canonical Zod schema (was a
  hand-written open interface). Backward-compatible: still exported from the
  package index. Runtime-enriched fields (`dependencies`, `bundled`, `source`)
  are no longer part of the author type.
- `pluginManifestSchema` is now strict (was passthrough). Unknown top-level
  keys are rejected. `authorManifestSchema` is the canonical name; the old
  name is kept as an alias.
- `safeParsePluginManifest` now returns all issues (was first-only) and
  distinguishes reserved runtime fields.
- Package version bumped to `0.2.0`; description updated to reflect the SDK +
  CLI scope.
- `package.json` adds the `bin`, `exports` (schema subpath), `schemas` files
  entry, and new scripts.

### Removed
- `source` field from the author manifest schema (runtime-classified, not
  author-settable; no current manifest sets it).

## [0.1.0] — 2026-07-14

### Added
- Initial public release of the OrgSDK plugin authoring contract.
- TypeScript types: `SafeFunction`, `SafeFunctionMetadata`, `SafeFunctionDocs`,
  `SafeFunctionTag`, `SafeFunctionCategory`, `PluginModule`, `PluginFactory`,
  `PluginContext`, `PluginManifest`, `PluginConfigDefinition`,
  `PluginTableSchema`, `AuthProvider`, `AuthMeta`, `HttpEndpoint`,
  `CredentialStore`, `ConfigStore`, `PluginLogger`, `CredentialMetadata`,
  `TenantConfigEntry`, `AnyZodLikeSchema`, MCP server config types.
- Runtime: `z` (Zod re-export), `pluginManifestSchema`,
  `parsePluginManifest`, `safeParsePluginManifest`.
- Manifest Zod schema covering name, version, description, auth, tables,
  pluginType, source, mcp, and marketplace with passthrough for unknown keys.
- CI workflow (SHA-pinned actions, frozen install, check, typecheck, tests,
  pack dry-run).
- Release workflow (tag-gated, explicit `NPM_TOKEN`, provenance, no auto-publish).
- Dependabot configuration.
- Apache-2.0 license.
