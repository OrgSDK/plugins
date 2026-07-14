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
		expect(api.VERSION).toBe("0.1.0");
	});

	it("exports parsePluginManifest + safeParsePluginManifest", () => {
		expect(typeof api.parsePluginManifest).toBe("function");
		expect(typeof api.safeParsePluginManifest).toBe("function");
	});

	it("exports pluginManifestSchema", () => {
		expect(api.pluginManifestSchema).toBeDefined();
		expect(typeof api.pluginManifestSchema.safeParse).toBe("function");
	});

	it("re-exports Zod's z from the same module identity as direct zod import", async () => {
		const zod = await import("zod");
		expect(api.z).toBe(zod.z);
	});
});
