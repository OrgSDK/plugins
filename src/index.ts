/**
 * @orgsdk/plugins — public authoring contract + SDK for OrgSDK plugins.
 *
 * Re-exports everything a plugin author needs:
 *   - Types: SafeFunction, PluginModule, PluginFactory, PluginContext, …
 *   - Stores: CredentialStore, ConfigStore, PluginLogger (structural)
 *   - Manifest: canonical Zod schema, inferred type, parse helpers
 *   - Schema generation: JSON Schema (Draft 2020-12) + drift check
 *   - Zod instance (`z`) for config schemas
 *
 * Importing types from this package is always safe (erased at compile time).
 * Runtime imports (`z`, `parsePluginManifest`) require `zod` as a peer
 * dependency — your plugin's `package.json` should list `zod` as a runtime
 * dependency so the daemon resolves a single Zod instance.
 *
 * @example
 * ```ts
 * import type { PluginFactory, SafeFunction } from "@orgsdk/plugins";
 * import { z } from "zod";
 *
 * const search: SafeFunction = {
 *   name: "search",
 *   handler: async (apiKey: string, query: string) => { … },
 *   requiredCredentials: ["myprovider"],
 * };
 *
 * const create: PluginFactory = (ctx) => ({ safeFunctions: [search] });
 * export default create;
 * ```
 */

// Zod instance — re-exported so authors can import from one place.
export { z } from "zod";
export type {
	AuthorManifest,
	PluginManifest,
	PluginManifestSchema,
	SafeParseResult,
} from "./manifest";

// Canonical manifest schema + parse helpers + reserved-field registry.
export {
	authorManifestSchema,
	MANIFEST_SCHEMA_URL,
	parseAuthorManifest,
	parsePluginManifest,
	pluginManifestSchema,
	RESERVED_RUNTIME_FIELDS,
	safeParseAuthorManifest,
	safeParsePluginManifest,
} from "./manifest";
export type { DriftResult } from "./schema-gen";

// JSON Schema generation + drift guard (release build / tests).
export {
	checkSchemaDrift,
	generateManifestJsonSchema,
	serializeManifestJsonSchema,
	writeManifestJsonSchema,
} from "./schema-gen";
export type {
	ConfigStore,
	CredentialMetadata,
	CredentialSecretBundle,
	CredentialStore,
	PluginLogger,
	TenantConfigEntry,
} from "./stores";
// All structural types (compile-time only).
export type {
	AnyZodLikeSchema,
	AuthMeta,
	AuthProvider,
	HttpEndpoint,
	McpHttpConfig,
	McpRemoteBaseConfig,
	McpRemoteServerConfig,
	McpSseConfig,
	McpTransportKind,
	PluginConfigDefinition,
	PluginContext,
	PluginFactory,
	PluginModule,
	PluginTableSchema,
	SafeFunction,
	SafeFunctionCategory,
	SafeFunctionDocs,
	SafeFunctionMetadata,
	SafeFunctionTag,
} from "./types";
// Package version — single source of truth.
export { VERSION } from "./version";
