/**
 * Export surface guard — ensures the public API exports the expected set
 * of types and runtime values without requiring any private package.
 */
import { describe, expect, it } from "bun:test";
import * as api from "../src/index";

describe("public API surface", () => {
	it("exports z (Zod instance)", () => {
		expect(api.z).toBeDefined();
		expect(typeof api.z.object).toBe("function");
	});

	it("exports VERSION", () => {
		expect(api.VERSION).toBe("0.2.1");
	});

	it("exports parsePluginManifest + safeParsePluginManifest", () => {
		expect(typeof api.parsePluginManifest).toBe("function");
		expect(typeof api.safeParsePluginManifest).toBe("function");
	});

	it("exports authorManifestSchema + pluginManifestSchema alias", () => {
		expect(api.authorManifestSchema).toBeDefined();
		expect(api.pluginManifestSchema).toBe(api.authorManifestSchema);
		expect(typeof api.authorManifestSchema.safeParse).toBe("function");
	});

	it("exports canonical schema URL + reserved fields", () => {
		expect(api.MANIFEST_SCHEMA_URL).toBe(
			"https://orgsdk.ai/schemas/plugin-manifest.v1.json",
		);
		expect(api.RESERVED_RUNTIME_FIELDS).toContain("dependencies");
	});

	it("exports JSON Schema generation helpers", () => {
		expect(typeof api.generateManifestJsonSchema).toBe("function");
		expect(typeof api.checkSchemaDrift).toBe("function");
		const js = api.generateManifestJsonSchema();
		expect(js.$id).toBe(api.MANIFEST_SCHEMA_URL);
		expect(js.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
	});

	it("re-exports Zod's z from the same module identity as direct zod import", async () => {
		const zod = await import("zod");
		expect(api.z).toBe(zod.z);
	});
});
