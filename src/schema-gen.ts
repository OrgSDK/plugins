/**
 * JSON Schema generation + drift check for the plugin author manifest.
 *
 * The committed `schemas/plugin-manifest.v1.json` is generated from the Zod
 * schema via Zod 4's first-party `z.toJSONSchema` (Draft 2020-12). Runtime
 * consumers never need to generate schemas; this module exists for the release
 * build (`scripts/generate-schema.ts`) and the drift-guard test.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { authorManifestSchema, MANIFEST_SCHEMA_URL } from "./manifest";

type JsonSchema = Record<string, unknown>;

/**
 * Generate the Draft 2020-12 JSON Schema for the author manifest from the
 * canonical Zod schema. Adds the branded `$id`.
 */
export function generateManifestJsonSchema(): JsonSchema {
	const schema = z.toJSONSchema(authorManifestSchema, {
		target: "draft-2020-12",
	});
	// `$id` is the stable, branded URL authors put in `$schema`. It is not
	// emitted by z.toJSONSchema, so stamp it on after generation.
	schema.$id = MANIFEST_SCHEMA_URL;
	return schema;
}

/** Serialize the generated schema with stable, sorted key ordering. */
export function serializeManifestJsonSchema(schema: JsonSchema): string {
	return `${JSON.stringify(sortKeys(schema), null, "\t")}\n`;
}

/** Deterministic key ordering so committed output is diff-stable. */
function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	const record = asStringRecord(value);
	if (record) {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) {
			out[key] = sortKeys(record[key]);
		}
		return out;
	}
	return value;
}

/** Narrow `unknown` to a string-keyed record, or null. */
function asStringRecord(value: unknown): Record<string, unknown> | null {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return null;
}

export interface DriftResult {
	/** True when the committed file matches a fresh generation. */
	ok: boolean;
	/** Human-readable summary for CI / test output. */
	message: string;
}

/**
 * Compare the committed schema file against a fresh generation. Use in tests
 * and CI to fail loudly when the Zod schema and committed JSON drift apart.
 */
export async function checkSchemaDrift(
	schemaPath: string,
): Promise<DriftResult> {
	const fresh = serializeManifestJsonSchema(generateManifestJsonSchema());
	let committed: string;
	try {
		committed = await readFile(schemaPath, "utf-8");
	} catch {
		return {
			ok: false,
			message: `Schema file not found: ${schemaPath}. Run \`bun run generate-schema\`.`,
		};
	}
	if (committed === fresh) {
		return { ok: true, message: "Schema is in sync with the Zod source." };
	}
	return {
		ok: false,
		message:
			`Schema drift detected: ${schemaPath} does not match the Zod schema.\n` +
			"Run `bun run generate-schema` and commit the result.",
	};
}

/** Write the generated schema to disk (used by the generate-schema script). */
export async function writeManifestJsonSchema(
	schemaPath: string,
): Promise<void> {
	await mkdir(dirname(schemaPath), { recursive: true });
	await writeFile(
		schemaPath,
		serializeManifestJsonSchema(generateManifestJsonSchema()),
	);
}
