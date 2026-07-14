/**
 * Plugin manifest validation — Zod schema + parse helpers.
 *
 * A `.plugin.json` manifest declares a plugin's identity, auth, tables, and
 * optional marketplace metadata. `parsePluginManifest` validates a parsed
 * JSON object against the contract; `safeParsePluginManifest` returns a
 * result discriminated union instead of throwing.
 */

import { z } from "zod";

const manifestAuthSchema = z.object({
	type: z.enum(["oauth2", "token"]),
	provider: z.string().min(1),
	scopes: z.array(z.string()).optional(),
	callbackPath: z.string().optional(),
	firstParty: z.boolean().optional(),
	label: z.string().optional(),
	hint: z.string().optional(),
});

const manifestColumnSchema = z.object({
	name: z.string().min(1),
	type: z.string().min(1),
	notNull: z.boolean().optional(),
	default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	description: z.string().optional(),
	tsType: z.string().optional(),
});

const manifestTableSchema = z.object({
	name: z.string().min(1),
	columns: z.array(manifestColumnSchema),
	description: z.string().optional(),
});

const manifestMcpHttpSchema = z.object({
	transport: z.literal("http"),
	url: z.string().url(),
	tools: z.array(z.string()).optional(),
	timeoutMs: z.number().int().positive().optional(),
	connectTimeoutMs: z.number().int().positive().optional(),
	docs: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
});

const manifestMcpSseSchema = z.object({
	transport: z.literal("sse"),
	url: z.string().url(),
	tools: z.array(z.string()).optional(),
	timeoutMs: z.number().int().positive().optional(),
	connectTimeoutMs: z.number().int().positive().optional(),
	docs: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
});

/**
 * The canonical plugin manifest schema. `passthrough()` preserves unknown
 * keys (the manifest is an open shape with `[key: string]: unknown`), so
 * new optional fields round-trip without a version bump of this package.
 */
export const pluginManifestSchema = z
	.object({
		name: z.string().min(1),
		version: z.string().min(1),
		description: z.string(),
		entry: z.string().optional(),
		auth: manifestAuthSchema.optional(),
		tables: z.array(manifestTableSchema).optional(),
		pluginType: z.enum(["native", "mcp"]).optional(),
		source: z.enum(["catalog", "custom"]).optional(),
		mcp: z.union([manifestMcpHttpSchema, manifestMcpSseSchema]).optional(),
		marketplace: z.record(z.string(), z.unknown()).optional(),
	})
	.passthrough();

export type PluginManifestSchema = typeof pluginManifestSchema;

/** Result of a non-throwing manifest parse. */
export type SafeParseResult =
	| { success: true; data: Record<string, unknown> }
	| { success: false; error: string };

/**
 * Validate a parsed JSON manifest object against the plugin contract.
 * Throws on invalid input.
 */
export function parsePluginManifest(raw: unknown): Record<string, unknown> {
	return pluginManifestSchema.parse(raw);
}

/**
 * Validate without throwing. Returns `{ success, data }` or
 * `{ success, error }` with a human-readable error string.
 */
export function safeParsePluginManifest(raw: unknown): SafeParseResult {
	const result = pluginManifestSchema.safeParse(raw);
	if (result.success) {
		return { success: true, data: result.data };
	}
	const first = result.error.issues[0];
	const path = first?.path?.length ? first.path.join(".") : "(root)";
	return {
		success: false,
		error: `${path}: ${first?.message ?? "validation failed"}`,
	};
}
