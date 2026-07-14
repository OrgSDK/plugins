/**
 * Public plugin authoring types for OrgSDK.
 *
 * These structural types describe the contract between a plugin author and
 * the OrgSDK daemon. The daemon imports a plugin's entry, resolves a
 * PluginFactory(ctx) → PluginModule, and converts safeFunctions into
 * sandbox globals callable from agent-authored workflows.
 *
 * All exports are TypeScript types (erased at compile time) unless noted.
 */

import type { ZodType } from "zod";
import type { ConfigStore, CredentialStore, PluginLogger } from "./stores";

// ─── Zod ─────────────────────────────────────────────────────────────────

/**
 * Minimal Zod-like schema type. Uses `any` deliberately to avoid coupling
 * to a specific Zod version — the loader only calls `zodToJsonSchema()` and
 * `.safeParse()`.
 */
// biome-ignore lint/suspicious/noExplicitAny: Zod's own Output/Def generics require any here
export type AnyZodLikeSchema = ZodType<any, any, any>;

// ─── Safe function types ─────────────────────────────────────────────────

export type SafeFunctionTag =
	| "readonly"
	| "discovery"
	| "debug"
	| "io"
	| "data"
	| "llm"
	| "auth"
	| "experimental"
	| "deprecated"
	| string;

export type SafeFunctionCategory =
	| "core"
	| "data"
	| "llm"
	| "google"
	| "github"
	| "coding"
	| "file"
	| "network"
	| "utility"
	| string;

export interface SafeFunctionMetadata {
	category?: SafeFunctionCategory;
	tags?: SafeFunctionTag[];
	readonly?: boolean;
	discovery?: boolean;
	debug?: boolean;
	version?: string;
	relatedTo?: string[];
	[key: string]: unknown;
}

export interface SafeFunctionDocs {
	summary?: string;
	parameters?: Array<{
		name: string;
		type: string;
		description: string;
		example?: string;
		optional?: boolean;
		defaultValue?: string;
	}>;
	returns?: { type: string; description: string; example?: string };
	examples?: Array<{ title: string; description?: string; code: string }>;
	caveats?: string[];
	seeAlso?: string[];
}

/**
 * A capability exposed to the VM sandbox as a global function.
 *
 * `handler` uses `any` because plugin function signatures are inherently
 * variable — each safe function has its own parameter types. The daemon
 * injects resolved credential bundles as leading positional args, followed
 * by the caller's arguments.
 */
export interface SafeFunction {
	name: string;
	// biome-ignore lint/suspicious/noExplicitAny: handler signatures are inherently variable; credential bundles + caller args differ per function
	handler: (...args: any[]) => any;
	description?: string;
	returnType?: string;
	typeDeclarations?: string;
	parameters?: Array<{
		name: string;
		type: string;
		description?: string;
		optional?: boolean;
	}>;
	requiredCredentials?: string[];
	resolveSecretRefs?: boolean;
	metadata?: SafeFunctionMetadata;
	docs?: SafeFunctionDocs;
	injectAgentContext?: boolean;
	timeout?: number;
	moduleName?: string;
}

// ─── Config / tables / manifest ──────────────────────────────────────────

export interface PluginConfigDefinition {
	title?: string;
	description?: string;
	schema: AnyZodLikeSchema;
}

export interface PluginTableSchema {
	name: string;
	columns: Array<{
		name: string;
		type: string;
		notNull?: boolean;
		default?: string | number | boolean | null;
		description?: string;
		tsType?: string;
	}>;
	description?: string;
}

export type McpTransportKind = "http" | "sse";

export interface McpRemoteBaseConfig {
	tools?: string[];
	timeoutMs?: number;
	connectTimeoutMs?: number;
	docs?: string;
}

export interface McpHttpConfig extends McpRemoteBaseConfig {
	transport: "http";
	url: string;
	headers?: Record<string, string>;
}

export interface McpSseConfig extends McpRemoteBaseConfig {
	transport: "sse";
	url: string;
	headers?: Record<string, string>;
}

export type McpRemoteServerConfig = McpHttpConfig | McpSseConfig;

export interface PluginManifest {
	name: string;
	version: string;
	description: string;
	entry?: string;
	auth?: {
		type: "oauth2" | "token";
		provider: string;
		scopes?: string[];
		callbackPath?: string;
		firstParty?: boolean;
		label?: string;
		hint?: string;
	};
	tables?: PluginTableSchema[];
	pluginType?: "native" | "mcp";
	source?: "catalog" | "custom";
	mcp?: McpRemoteServerConfig;
	marketplace?: Record<string, unknown>;
	[key: string]: unknown;
}

// ─── Auth + HTTP extension points ────────────────────────────────────────

export interface AuthMeta {
	displayName?: string;
	configField?: { label: string; placeholder?: string };
}

export interface AuthProvider {
	type: "oauth2" | "token";
	authMeta?: AuthMeta;
	initiate(credentialName: string): Promise<{ authUrl: string; state: string }>;
	handleCallback(
		req: Request,
	): Promise<{ success: boolean; credentialName: string; error?: string }>;
	refresh?(bundle: Record<string, unknown>): Promise<Record<string, unknown>>;
	configure?(json: string, credentialName: string): Promise<void>;
	storeToken?(credentialName: string, token: string): Promise<void>;
	authSetup?(
		options: Record<string, string>,
	): Promise<{ success: boolean; message?: string; error?: string }>;
	isFirstPartyAvailable?(): Promise<boolean>;
}

export interface HttpEndpoint {
	method: "GET" | "POST";
	path: string;
	handler: (req: Request) => Response | Promise<Response>;
}

// ─── Plugin context / module / factory ───────────────────────────────────

export interface PluginContext {
	stores: { credential: CredentialStore; config: ConfigStore };
	publicBaseUrl: string;
	logger: PluginLogger;
}

export interface PluginModule {
	safeFunctions?: SafeFunction[];
	httpEndpoints?: HttpEndpoint[];
	authProvider?: AuthProvider;
	config?: PluginConfigDefinition;
	onLoad?: (ctx: PluginContext) => Promise<void>;
}

export type PluginFactory = (
	ctx: PluginContext,
) => PluginModule | Promise<PluginModule>;
