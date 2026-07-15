/**
 * Manifest + source-isolation validation (library API).
 *
 * Checks:
 *   1. `.plugin.json` parses and satisfies the canonical Zod author schema.
 *   2. The manifest `entry` exists and is a regular file.
 *   3. No forbidden imports in plugin source (private @orgsdk/*, cross-plugin).
 *   4. `@orgsdk/plugins` is imported type-only (it is a dev-only authoring SDK).
 *
 * Returns a structured result so tests and the CLI share one code path.
 */

import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { safeParsePluginManifest } from "../manifest";
import { collectFiles, isFile, readManifestRaw } from "./fs";

export interface ValidationViolation {
	file: string;
	rule: string;
	detail: string;
}

export interface ValidateOptions {
	/** Repository root (for relative path display). */
	root: string;
	/** Plugin source directory. */
	pluginDir: string;
}

export interface ValidateResult {
	ok: boolean;
	name?: string;
	version?: string;
	violations: ValidationViolation[];
}

/** Matches `@orgsdk/<pkg>` or `orgsdk/<subpath>` import specifiers. */
const FORBIDDEN_SPECIFIERS =
	/(?:^|\n)\s*import\b[^;]*?from\s+["']((?:@orgsdk\/|orgsdk\/)[^"']+)["']/g;

/** Matches value (non-type) imports from @orgsdk/plugins — forbidden at runtime. */
const SDK_VALUE_IMPORT =
	/(?:^|\n)\s*import\s+(?!type\b)\{[^}]*\}\s+from\s+["']@orgsdk\/plugins["']/;

const REL_MANIFEST = "plugin/.plugin.json";

export async function validatePlugin(
	opts: ValidateOptions,
): Promise<ValidateResult> {
	const violations: ValidationViolation[] = [];

	const raw = await readManifest(opts.pluginDir, violations);
	let name: string | undefined;
	let version: string | undefined;

	if (raw !== undefined) {
		const result = safeParsePluginManifest(raw);
		if (!result.success) {
			for (const line of result.error.split("\n")) {
				violations.push({
					file: REL_MANIFEST,
					rule: "manifest-schema",
					detail: line,
				});
			}
		} else {
			name = result.data.name;
			version = result.data.version;
			await validateEntry(result.data.entry, opts, violations);
		}
	}

	await validateSourcePurity(opts, violations);

	return { ok: violations.length === 0, name, version, violations };
}

async function readManifest(
	pluginDir: string,
	violations: ValidationViolation[],
): Promise<unknown | undefined> {
	try {
		return await readManifestRaw(pluginDir);
	} catch (err) {
		violations.push({
			file: REL_MANIFEST,
			rule: "manifest-unreadable",
			detail: err instanceof Error ? err.message : String(err),
		});
		return undefined;
	}
}

async function validateEntry(
	entry: string | undefined,
	opts: ValidateOptions,
	violations: ValidationViolation[],
): Promise<void> {
	if (!entry) return;
	const entryPath = join(opts.pluginDir, entry);
	if (!(await isFile(entryPath))) {
		violations.push({
			file: rel(opts, entryPath),
			rule: "entry-missing",
			detail: `Manifest entry "${entry}" does not exist`,
		});
	}
}

async function validateSourcePurity(
	opts: ValidateOptions,
	violations: ValidationViolation[],
): Promise<void> {
	for (const f of await collectFiles(opts.pluginDir)) {
		if (!f.abs.endsWith(".ts")) continue;
		const src = await readFile(f.abs, "utf-8");
		const relPath = rel(opts, f.abs);
		checkForbiddenImports(src, relPath, violations);
		if (SDK_VALUE_IMPORT.test(src)) {
			violations.push({
				file: relPath,
				rule: "sdk-value-import",
				detail:
					"Value import from @orgsdk/plugins — use `import type` only (the SDK is dev-only)",
			});
		}
	}
}

function checkForbiddenImports(
	src: string,
	relPath: string,
	violations: ValidationViolation[],
): void {
	for (const match of src.matchAll(FORBIDDEN_SPECIFIERS)) {
		const spec = match[1];
		if (spec === "@orgsdk/plugins" || spec.startsWith("@orgsdk/plugins/")) {
			continue;
		}
		violations.push({
			file: relPath,
			rule: "forbidden-import",
			detail: `Import of internal package "${spec}" — external plugins must not depend on private OrgSDK packages`,
		});
	}
}

function rel(opts: ValidateOptions, abs: string): string {
	return relative(opts.root, abs) || abs;
}
