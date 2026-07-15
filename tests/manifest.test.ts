import { describe, expect, it } from "bun:test";
import {
	authorManifestSchema,
	MANIFEST_SCHEMA_URL,
	parsePluginManifest,
	RESERVED_RUNTIME_FIELDS,
	safeParsePluginManifest,
} from "../src/manifest";

const VALID = {
	name: "my-plugin",
	version: "1.0.0",
	description: "A test plugin",
	entry: "index.ts",
	auth: { type: "token", provider: "myprovider" },
};

describe("parsePluginManifest", () => {
	it("accepts a valid manifest", () => {
		const data = parsePluginManifest(VALID);
		expect(data.name).toBe("my-plugin");
	});

	it("accepts $schema matching the canonical URL", () => {
		const data = parsePluginManifest({
			...VALID,
			$schema: MANIFEST_SCHEMA_URL,
		});
		expect(data.$schema).toBe(MANIFEST_SCHEMA_URL);
	});

	it("rejects a mistyped $schema URL", () => {
		expect(() =>
			parsePluginManifest({
				...VALID,
				$schema: "https://wrong.example/x.json",
			}),
		).toThrow();
	});

	it("rejects unknown top-level keys (typo catching)", () => {
		expect(() => parsePluginManifest({ ...VALID, customField: 42 })).toThrow();
	});

	it("accepts structured marketplace metadata", () => {
		const data = parsePluginManifest({
			...VALID,
			marketplace: { displayName: "My Plugin", tags: ["search"] },
		});
		expect(data.marketplace?.displayName).toBe("My Plugin");
	});

	it("rejects unknown marketplace keys", () => {
		const result = safeParsePluginManifest({
			...VALID,
			marketplace: { displayName: "X", bogus: true },
		});
		expect(result.success).toBe(false);
	});

	it("throws on missing name", () => {
		expect(() =>
			parsePluginManifest({ version: "1.0.0", description: "" }),
		).toThrow();
	});

	it("throws on invalid auth type", () => {
		expect(() =>
			parsePluginManifest({ ...VALID, auth: { type: "basic", provider: "x" } }),
		).toThrow();
	});

	it("rejects a non-semver version", () => {
		const result = safeParsePluginManifest({ ...VALID, version: "1.0" });
		expect(result.success).toBe(false);
	});
});

describe("reserved runtime-enriched fields", () => {
	it("exports the reserved field list", () => {
		expect(RESERVED_RUNTIME_FIELDS).toContain("dependencies");
		expect(RESERVED_RUNTIME_FIELDS).toContain("bundled");
	});

	for (const field of RESERVED_RUNTIME_FIELDS) {
		it(`rejects author-set "${field}" with a reserved-field message`, () => {
			const result = safeParsePluginManifest({ ...VALID, [field]: "x" });
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("runtime-enriched");
			}
		});
	}
});

describe("safeParsePluginManifest", () => {
	it("returns success with data for valid input", () => {
		const result = safeParsePluginManifest(VALID);
		expect(result.success).toBe(true);
	});

	it("returns error string for invalid input", () => {
		const result = safeParsePluginManifest({ name: "" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(typeof result.error).toBe("string");
			expect(result.error.length).toBeGreaterThan(0);
		}
	});

	it("reports multiple issues", () => {
		const result = safeParsePluginManifest({ name: "", version: "bad" });
		expect(result.success).toBe(false);
		if (!result.success) {
			const lines = result.error.split("\n");
			expect(lines.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("accepts MCP http config", () => {
		const result = safeParsePluginManifest({
			...VALID,
			pluginType: "mcp",
			mcp: { transport: "http", url: "https://example.com/mcp" },
		});
		expect(result.success).toBe(true);
	});

	it("rejects MCP config with invalid URL", () => {
		const result = safeParsePluginManifest({
			...VALID,
			pluginType: "mcp",
			mcp: { transport: "http", url: "not-a-url" },
		});
		expect(result.success).toBe(false);
	});
});

describe("authorManifestSchema", () => {
	it("accepts tables with column definitions", () => {
		const result = authorManifestSchema.safeParse({
			...VALID,
			tables: [
				{
					name: "cache",
					columns: [{ name: "key", type: "text", notNull: true }],
				},
			],
		});
		expect(result.success).toBe(true);
	});

	it("infers the AuthorManifest type with marketplace", () => {
		const m = parsePluginManifest({
			...VALID,
			marketplace: {
				displayName: "X",
				links: { homepage: "https://x.example" },
			},
		});
		expect(m.marketplace?.links?.homepage).toBe("https://x.example");
	});
});
