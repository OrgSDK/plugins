# @orgsdk/plugins

Public authoring contract, types, and validation helpers for **OrgSDK plugin developers**.

This package provides the stable TypeScript types and manifest validation that a plugin author needs — without importing any private daemon, platform, or database internals. It is the single canonical contract between plugin authors and the OrgSDK runtime.

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

## What's included

| Category | Exports |
|---|---|
| **Types** | `SafeFunction`, `SafeFunctionMetadata`, `SafeFunctionDocs`, `PluginModule`, `PluginFactory`, `PluginContext`, `PluginManifest`, `AuthProvider`, `AuthMeta`, `HttpEndpoint`, `PluginConfigDefinition`, `PluginTableSchema`, `CredentialStore`, `ConfigStore`, `PluginLogger`, MCP types |
| **Runtime** | `z` (Zod instance re-export), `parsePluginManifest`, `safeParsePluginManifest`, `pluginManifestSchema` |

### Manifest validation

```ts
import { safeParsePluginManifest } from "@orgsdk/plugins";

const result = safeParsePluginManifest(parsedJson);
if (!result.success) {
  console.error(result.error); // human-readable
}
```

## Compatibility policy

- **Type-only imports** (`import type { … }`) are always safe — they are erased at compile time and add zero runtime weight.
- **Runtime imports** (`z`, `parsePluginManifest`) require the `zod` peer dependency.
- Breaking changes to the type contract will be accompanied by a major version bump.
- The package is licensed Apache-2.0 — permissive for all use.

## Publishing (npm)

> **This package is prepared for npm but not yet published.** Publication requires explicit authentication.

To publish:

1. **Set up npm auth:** Add an npm automation token as the `NPM_TOKEN` secret in the GitHub repository settings (Settings → Secrets and variables → Actions).
2. **Create a release environment:** Create a `release` environment in GitHub (Settings → Environments) and add required reviewers if desired.
3. **Tag a release:** `git tag v0.1.0 && git push origin v0.1.0` — the `release.yml` workflow runs typecheck, lint, tests, verifies `NPM_TOKEN`, then publishes with provenance.

The release workflow **never publishes on ordinary pushes** — only on explicit version tags or manual dispatch. It fails clearly if `NPM_TOKEN` is absent.

## Repository

- **GitHub:** [OrgSDK/plugins](https://github.com/OrgSDK/plugins)
- **Issues:** [OrgSDK/plugins/issues](https://github.com/OrgSDK/plugins/issues)

## License

Apache-2.0
