# @orgsdk/plugins

Authoring contract, types, validation, **CLI**, and release mechanics for **OrgSDK plugin developers**.

This package is the single canonical contract between plugin authors and the OrgSDK runtime: the TypeScript types, the Zod manifest schema (from which the public type and JSON Schema are generated), the `orgsdk-plugin` CLI for validating, packaging, versioning, and publishing plugins, and the reusable library functions beneath it.

## Installation

```sh
bun add -d @orgsdk/plugins
# or
npm install --save-dev @orgsdk/plugins
```

**Zod** is a peer dependency. Your plugin should also list it as a runtime dependency so the daemon resolves a single Zod instance:

```json
{
  "dependencies": { "zod": "^4.0.0" }
}
```

## Quick start

```ts
import type { PluginFactory, SafeFunction } from "@orgsdk/plugins";
import { z } from "zod";

const search: SafeFunction = {
  name: "search",
  handler: async (apiKey: string, query: string) => {
    const res = await fetch("https://api.example.com/search", {
      headers: { "X-API-Key": apiKey },
      body: JSON.stringify({ query }),
    });
    return res.json();
  },
  description: "Search the web",
  requiredCredentials: ["myprovider"],
  returnType: "Promise<SearchResult>",
};

const createPlugin: PluginFactory = (ctx) => {
  return {
    safeFunctions: [search],
    config: {
      title: "My Plugin",
      description: "Web search for agents.",
      schema: z.object({
        maxResults: z.number().int().min(1).max(100).optional(),
      }),
    },
  };
};

export default createPlugin;
```

## The `orgsdk-plugin` CLI

A Bun-native CLI replaces the per-repository `scripts/` directory. A plugin repository delegates its package scripts to the SDK:

```json
{
  "scripts": {
    "validate": "orgsdk-plugin validate",
    "package": "orgsdk-plugin package",
    "version-guard": "orgsdk-plugin version-guard",
    "publish": "orgsdk-plugin publish",
    "build": "orgsdk-plugin validate && orgsdk-plugin package"
  }
}
```

### Commands

| Command | Outcome |
|---|---|
| `orgsdk-plugin validate` | Validate the manifest (canonical Zod schema), entry point, and source isolation with actionable file/field errors. |
| `orgsdk-plugin package` | Build the deterministic catalog artifact: staged source, generated `package.json` (runtime deps), checksum manifest, and tarball. No network. |
| `orgsdk-plugin version-guard` | Keep package/manifest versions synchronized and require a bump when publishable content changes. |
| `orgsdk-plugin publish` | Dry-run by default. Publishes a validated artifact when an authorized catalog token and URL are present. Never logs tokens. |
| `orgsdk-plugin generate-schema` | Regenerate the committed JSON Schema from the Zod source. |

### Options

| Option | Applies to | Default |
|---|---|---|
| `--root <dir>` | all | `cwd` |
| `--plugin-dir <dir>` | all | `<root>/plugin` |
| `--url <url>` | publish | `ORGSDK_CATALOG_URL` env |
| `--token <token>` | publish | `ORGSDK_PUBLISH_TOKEN` env |
| `--publish` | publish | omitted → dry-run |

`publish` defaults to **dry-run** and makes no network call. A real publish requires `--publish` **and** a token. Tokens are placed only in the `Authorization` header and are never logged or echoed in errors.

## The manifest contract

Every manifest begins with the canonical `$schema` for editor completion:

```json
{
  "$schema": "https://orgsdk.ai/schemas/plugin-manifest.v1.json",
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "What this plugin does.",
  "entry": "index.ts"
}
```

- **One source of truth:** the Zod author schema (`authorManifestSchema`) is canonical. The public TypeScript type (`AuthorManifest` / `PluginManifest`) is inferred from it, and the JSON Schema is generated from it.
- **Strict:** unknown top-level and marketplace keys are rejected so typos surface locally.
- **Typed marketplace:** `marketplace` has a real schema covering the full
  official metadata surface (`group`, `displayName`, `category`, `tagline`,
  `tags`, `useCases`, `permissionsSummary`, `screenshots`, `seoOverview`,
  `minRuntimeVersion`, `links`), not free-form.
- **Reserved fields:** `dependencies` and `bundled` are runtime-enriched by the catalog and rejected if set by an author.
- **Semver:** `version` is validated as semver and must match `package.json`.

```ts
import { safeParsePluginManifest } from "@orgsdk/plugins";

const result = safeParsePluginManifest(parsedJson);
if (!result.success) {
  console.error(result.error); // multi-line, field-path errors
}
```

## JSON Schema

The committed Draft 2020-12 schema lives at `schemas/plugin-manifest.v1.json` and ships in the npm package. It is importable as a subpath export:

```js
import schema from "@orgsdk/plugins/schema/plugin-manifest.v1.json";
```

Authors put the **branded URL** (not the package path) in every manifest's `$schema`:

```json
{ "$schema": "https://orgsdk.ai/schemas/plugin-manifest.v1.json" }
```

A drift guard (`bun run schema:check`) fails if the committed file diverges from the Zod source. Regenerate after editing `src/manifest.ts`:

```sh
bun run generate-schema
```

## What's included

| Category | Exports |
|---|---|
| **Types** | `SafeFunction`, `SafeFunctionMetadata`, `SafeFunctionDocs`, `PluginModule`, `PluginFactory`, `PluginContext`, `AuthorManifest`, `PluginManifest`, `AuthProvider`, `AuthMeta`, `HttpEndpoint`, `PluginConfigDefinition`, `PluginTableSchema`, `CredentialStore`, `ConfigStore`, `PluginLogger`, MCP types |
| **Manifest** | `authorManifestSchema`, `pluginManifestSchema`, `parsePluginManifest`, `safeParsePluginManifest`, `RESERVED_RUNTIME_FIELDS`, `MANIFEST_SCHEMA_URL` |
| **Schema gen** | `generateManifestJsonSchema`, `checkSchemaDrift`, `writeManifestJsonSchema` |
| **Runtime** | `z` (Zod instance re-export) |

## Compatibility policy

- **Type-only imports** (`import type { … }`) are always safe — erased at compile time, zero runtime weight.
- **Runtime imports** (`z`, `parsePluginManifest`) require the `zod` peer dependency.
- Breaking changes to the type contract are accompanied by a major version bump.
- The package is pre-1.0; minor releases may include contract changes that are documented in the changelog.
- Licensed Apache-2.0 — permissive for all use.

## Reusable CI/CD workflows

This repository also maintains two **reusable GitHub workflows** that plugin
repositories call with `uses:` instead of copying CI/publish logic:

| Workflow | Purpose |
|---|---|
| [`plugin-ci.yml`](.github/workflows/plugin-ci.yml) | Lint, typecheck, tests, version guard, validate, package, artifact upload. |
| [`plugin-publish.yml`](.github/workflows/plugin-publish.yml) | Self-contained build + validated catalog publish (dry-run by default). |

They run in the **caller's** context (caller checkout, caller token/secrets),
invoke the caller's own `bun run` scripts + the `orgsdk-plugin` CLI, use
SHA-pinned actions, frozen installs, full history, least-privilege
permissions, and serialized non-cancelled publication. See
[`docs/reusable-workflows.md`](docs/reusable-workflows.md) for the minimal
caller workflow and exact template/Serper examples.

A static guard over these workflows runs in the test suite:

```sh
bun run workflows:check
```

## Publishing (npm)

> **This package is prepared for npm but not yet published.** Publication requires explicit authentication.

To publish:

1. **Set up npm auth:** Add an npm automation token as the `NPM_TOKEN` secret in the GitHub repository settings (Settings → Secrets and variables → Actions).
2. **Create a release environment:** Create a `release` environment in GitHub (Settings → Environments) and add required reviewers if desired.
3. **Tag a release:** `git tag v0.2.1 && git push origin v0.2.1` — the `release.yml` workflow runs typecheck, lint, tests, verifies `NPM_TOKEN`, then publishes with provenance.

The release workflow **never publishes on ordinary pushes** — only on manual dispatch. It fails clearly if `NPM_TOKEN` is absent.

## Repository

- **GitHub:** [OrgSDK/plugins](https://github.com/OrgSDK/plugins)
- **Issues:** [OrgSDK/plugins/issues](https://github.com/OrgSDK/plugins/issues)

## License

Apache-2.0
