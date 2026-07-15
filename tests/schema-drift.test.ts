import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";
import {
	checkSchemaDrift,
	generateManifestJsonSchema,
} from "../src/schema-gen";

const SCHEMA_PATH = resolve(
	import.meta.dir,
	"..",
	"schemas",
	"plugin-manifest.v1.json",
);

describe("schema generation + drift", () => {
	it("generates Draft 2020-12 with the branded $id", () => {
		const js = generateManifestJsonSchema();
		expect(js.$id).toBe("https://orgsdk.ai/schemas/plugin-manifest.v1.json");
		expect(js.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
	});

	it("generates additionalProperties:false at the root (strict)", () => {
		const js = generateManifestJsonSchema();
		expect(js.additionalProperties).toBe(false);
	});

	it("committed schema is in sync with the Zod source", async () => {
		const result = await checkSchemaDrift(SCHEMA_PATH);
		expect(result.ok).toBe(true);
		if (!result.ok) console.error(result.message);
	});
});
