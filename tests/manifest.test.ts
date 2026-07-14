import { describe, expect, it } from "bun:test";
import {
	parsePluginManifest,
	pluginManifestSchema,
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

	it("preserves unknown keys via passthrough", () => {
		const data = parsePluginManifest({ ...VALID, customField: 42 });
		expect(data.customField).toBe(42);
	});

	it("accepts marketplace metadata", () => {
		const data = parsePluginManifest({
			...VALID,
			marketplace: { displayName: "My Plugin", tags: ["search"] },
		});
		expect(data.marketplace).toEqual({
			displayName: "My Plugin",
			tags: ["search"],
		});
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

describe("pluginManifestSchema", () => {
	it("accepts tables with column definitions", () => {
		const result = pluginManifestSchema.safeParse({
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
});
