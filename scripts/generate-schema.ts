#!/usr/bin/env bun
/**
 * Regenerate the committed Draft 2020-12 JSON Schema for the plugin author
 * manifest from the canonical Zod schema. Run after editing `src/manifest.ts`.
 *
 *   bun run generate-schema
 *
 * The output is committed at `schemas/plugin-manifest.v1.json` and shipped in
 * the npm package. The drift-guard test (`tests/schema-drift.test.ts`) fails
 * if this file is out of sync with the Zod source.
 */

import { resolve } from "node:path";
import { writeManifestJsonSchema } from "../src/schema-gen";

const SCHEMA_PATH = resolve(
	import.meta.dir,
	"..",
	"schemas",
	"plugin-manifest.v1.json",
);

await writeManifestJsonSchema(SCHEMA_PATH);
console.log(`✓ Generated ${SCHEMA_PATH}`);
