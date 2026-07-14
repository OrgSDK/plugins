/**
 * @orgsdk/plugins — public authoring contract for OrgSDK plugin development.
 *
 * Re-exports everything a plugin author needs:
 *   - Types: SafeFunction, PluginModule, PluginFactory, PluginContext, …
 *   - Stores: CredentialStore, ConfigStore, PluginLogger (structural)
 *   - Manifest validation: parsePluginManifest, safeParsePluginManifest
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

// Package version — single source of truth.
export const VERSION = "0.1.0";

// Zod instance — re-exported so authors can optionally import from one place.
export { z } from "zod";
export type {
	PluginManifestSchema,
	SafeParseResult,
} from "./manifest";
// Manifest validation (runtime).
export {
	parsePluginManifest,
	pluginManifestSchema,
	safeParsePluginManifest,
} from "./manifest";
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
	PluginManifest,
	PluginModule,
	PluginTableSchema,
	SafeFunction,
	SafeFunctionCategory,
	SafeFunctionDocs,
	SafeFunctionMetadata,
	SafeFunctionTag,
} from "./types";
