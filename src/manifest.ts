/**
 * Canonical plugin author manifest — Zod schema (single source of truth).
 *
 * The Zod schema defined here is canonical for the author contract:
 *   - the public TypeScript type is inferred from it (`AuthorManifest`);
 *   - the published JSON Schema is generated from it (`schemas/plugin-manifest.v1.json`);
 *   - CLI validation and catalog upload validation consume it.
 *
 * Runtime-enriched fields (`dependencies`, `bundled`) are NOT author-settable;
 * they are rejected as reserved via {@link RESERVED_RUNTIME_FIELDS} and the
 * error formatter in {@link safeParsePluginManifest}.
 *
 * @see docs/product/strategy/plugin-authoring-sdk.md
 */

import { z } from "zod";

/** Stable, branded editor URL for the generated JSON Schema. */
export const MANIFEST_SCHEMA_URL =
	"https://orgsdk.ai/schemas/plugin-manifest.v1.json";

/** Fields enriched by the catalog/runtime — never author-settable. */
export const RESERVED_RUNTIME_FIELDS = ["dependencies", "bundled"] as const;

const semverRe = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const authSchema = z
	.object({
		type: z
			.enum(["oauth2", "token"])
			.describe("Credential model used by this plugin."),
		provider: z
			.string()
			.min(1)
			.describe("Stable provider id credentials are stored under."),
		scopes: z
			.array(z.string())
			.optional()
			.describe("OAuth2 scopes to request."),
		callbackPath: z.string().optional().describe("OAuth2 callback path."),
		firstParty: z
			.boolean()
			.optional()
			.describe("Whether first-party OAuth is available."),
		label: z
			.string()
			.optional()
			.describe("Human label for the credential field."),
		hint: z.string().optional().describe("Authoring hint shown to operators."),
	})
	.strict()
	.describe("Credential declaration for the plugin.");

const columnSchema = z
	.object({
		name: z.string().min(1).describe("Column name."),
		type: z
			.string()
			.min(1)
			.describe("Postgres column type (TEXT, INTEGER, …)."),
		notNull: z.boolean().optional().describe("NOT NULL constraint."),
		default: z
			.union([z.string(), z.number(), z.boolean(), z.null()])
			.optional()
			.describe("Column default value."),
		description: z.string().optional().describe("Column documentation."),
		tsType: z.string().optional().describe("TypeScript type override."),
	})
	.strict()
	.describe("A plugin-owned table column.");

const tableSchema = z
	.object({
		name: z.string().min(1).describe("Table name."),
		columns: z.array(columnSchema).describe("Column definitions."),
		description: z.string().optional().describe("Table documentation."),
	})
	.strict()
	.describe("A plugin-owned durable table.");

const mcpHttpSchema = z
	.object({
		transport: z.literal("http").describe("Streamable HTTP transport."),
		url: z.string().url().describe("MCP server endpoint URL."),
		tools: z.array(z.string()).optional().describe("Allow-list of tool names."),
		timeoutMs: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Request timeout."),
		connectTimeoutMs: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Connect timeout."),
		docs: z.string().optional().describe("Documentation URL."),
		headers: z
			.record(z.string(), z.string())
			.optional()
			.describe("Static request headers."),
	})
	.strict()
	.describe("MCP server over streamable HTTP.");

const mcpSseSchema = z
	.object({
		transport: z.literal("sse").describe("Server-Sent Events transport."),
		url: z.string().url().describe("MCP server endpoint URL."),
		tools: z.array(z.string()).optional().describe("Allow-list of tool names."),
		timeoutMs: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Request timeout."),
		connectTimeoutMs: z
			.number()
			.int()
			.positive()
			.optional()
			.describe("Connect timeout."),
		docs: z.string().optional().describe("Documentation URL."),
		headers: z
			.record(z.string(), z.string())
			.optional()
			.describe("Static request headers."),
	})
	.strict()
	.describe("MCP server over SSE.");

const marketplaceLinksSchema = z
	.object({
		homepage: z.string().url().optional().describe("Homepage URL."),
		docs: z.string().url().optional().describe("Documentation URL."),
		repository: z.string().url().optional().describe("Source repository URL."),
	})
	.strict()
	.describe("External links shown in the marketplace listing.");

const marketplaceSchema = z
	.object({
		displayName: z.string().min(1).optional().describe("Listing display name."),
		category: z.string().min(1).optional().describe("Marketplace category."),
		tagline: z.string().min(1).optional().describe("One-line summary."),
		tags: z
			.array(z.string().min(1))
			.optional()
			.describe("Search/discovery tags."),
		useCases: z
			.array(z.string().min(1))
			.optional()
			.describe("Bulleted use cases."),
		permissionsSummary: z
			.string()
			.min(1)
			.optional()
			.describe("Plain-language permissions summary."),
		links: marketplaceLinksSchema.optional().describe("External links."),
	})
	.strict()
	.describe("Marketplace listing metadata (typed, not free-form).");

/**
 * The canonical author manifest schema. Strict: unknown top-level keys are
 * rejected so typos surface locally rather than at catalog load.
 */
export const authorManifestSchema = z
	.object({
		$schema: z
			.literal(MANIFEST_SCHEMA_URL)
			.optional()
			.describe("JSON Schema URL for editor completion. Copy verbatim."),
		name: z
			.string()
			.min(1)
			.describe(
				"Plugin slug — unique catalog identifier (lowercase, kebab-case).",
			),
		version: z
			.string()
			.regex(semverRe)
			.describe("Semver version; must match package.json version."),
		description: z.string().describe("Short human-readable description."),
		entry: z
			.string()
			.min(1)
			.optional()
			.describe("Entry point file relative to the plugin directory."),
		auth: authSchema.optional().describe("Credential declaration."),
		tables: z
			.array(tableSchema)
			.optional()
			.describe("Plugin-owned durable tables."),
		pluginType: z
			.enum(["native", "mcp"])
			.optional()
			.describe("Plugin runtime type. Defaults to native."),
		mcp: z
			.union([mcpHttpSchema, mcpSseSchema])
			.optional()
			.describe("MCP server config (required when pluginType is mcp)."),
		marketplace: marketplaceSchema
			.optional()
			.describe("Marketplace listing metadata."),
	})
	.strict()
	.describe("OrgSDK plugin author manifest.");

/** Backward-compatible alias — the schema is the author manifest. */
export const pluginManifestSchema = authorManifestSchema;

/** Public author manifest type, inferred from the canonical Zod schema. */
export type AuthorManifest = z.infer<typeof authorManifestSchema>;

/** Backward-compatible alias for {@link AuthorManifest}. */
export type PluginManifest = AuthorManifest;

export type PluginManifestSchema = typeof authorManifestSchema;

/** Result of a non-throwing manifest parse. */
export type SafeParseResult =
	| { success: true; data: AuthorManifest }
	| { success: false; error: string };

/** Validate a parsed JSON manifest; throws on invalid input. */
export function parsePluginManifest(raw: unknown): AuthorManifest {
	return authorManifestSchema.parse(raw);
}

/** Validate a parsed JSON manifest; throws on invalid input. */
export const parseAuthorManifest = parsePluginManifest;

/**
 * Validate without throwing. Returns `{ success, data }` or
 * `{ success, error }` with a human-readable, multi-line error string.
 * Reserved runtime-enriched fields are reported with a targeted message.
 */
export function safeParsePluginManifest(raw: unknown): SafeParseResult {
	const result = authorManifestSchema.safeParse(raw);
	if (result.success) return { success: true, data: result.data };
	return { success: false, error: formatManifestError(result.error) };
}

/** Backward-compatible alias for {@link safeParsePluginManifest}. */
export const safeParseAuthorManifest = safeParsePluginManifest;

function formatManifestError(error: z.ZodError): string {
	const reserved = RESERVED_RUNTIME_FIELDS as readonly string[];
	const lines: string[] = [];
	for (const issue of error.issues) {
		if (issue.code === "unrecognized_keys") {
			for (const key of (issue as { keys: string[] }).keys) {
				if (reserved.includes(key)) {
					lines.push(
						`(root): "${key}" is a runtime-enriched field set by the catalog — remove it from your manifest`,
					);
				} else {
					lines.push(
						`(root): unknown field "${key}" — remove it or move it under a documented extension`,
					);
				}
			}
			continue;
		}
		const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
		lines.push(`${path}: ${issue.message}`);
	}
	return lines.join("\n");
}
