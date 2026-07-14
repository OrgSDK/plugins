# Changelog

All notable changes to `@orgsdk/plugins` are documented here.
This project follows [Keep a Changelog](https://keepachangelog.com/) and uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
