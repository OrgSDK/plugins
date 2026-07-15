#!/usr/bin/env bun
/**
 * orgsdk-plugin — CLI for authoring, validating, packaging, versioning, and
 * publishing OrgSDK plugins.
 *
 * Commands:
 *   validate        Validate the manifest, entry point, and source isolation.
 *   package         Build the deterministic catalog artifact + checksum.
 *   version-guard   Check version sync + content-change bump.
 *   publish         Dry-run (default) or publish to the catalog.
 *   generate-schema Regenerate the committed JSON Schema from Zod.
 *
 * Options (all commands):
 *   --root <dir>        Repository root (default: cwd)
 *   --plugin-dir <dir>  Plugin source directory (default: <root>/plugin)
 *
 * Publish options:
 *   --url <url>         Catalog URL (or ORGSDK_CATALOG_URL)
 *   --token <token>     Catalog token (or ORGSDK_PUBLISH_TOKEN)
 *   --publish           Actually publish (default: dry-run)
 */

import { exit } from "node:process";
import { writeManifestJsonSchema } from "./schema-gen";
import { resolvePluginDir, resolveRoot } from "./sdk/fs";
import { packagePlugin } from "./sdk/package";
import { publishPlugin } from "./sdk/publish";
import { validatePlugin } from "./sdk/validate";
import { versionGuard } from "./sdk/version-guard";

const SCHEMA_PATH = "schemas/plugin-manifest.v1.json";

interface GlobalOpts {
	root: string;
	pluginDir: string;
}

function parseGlobal(argv: string[]): { global: GlobalOpts; rest: string[] } {
	const rest: string[] = [];
	let root: string | undefined;
	let pluginDir: string | undefined;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--root") root = argv[++i];
		else if (a === "--plugin-dir") pluginDir = argv[++i];
		else rest.push(a);
	}
	const r = resolveRoot(root);
	return {
		global: { root: r, pluginDir: resolvePluginDir(r, pluginDir) },
		rest,
	};
}

function opt(argv: string[], name: string): string | undefined {
	const i = argv.indexOf(`--${name}`);
	return i >= 0 ? argv[i + 1] : undefined;
}

function flag(argv: string[], name: string): boolean {
	return argv.includes(`--${name}`);
}

async function main(): Promise<void> {
	const [command, ...raw] = process.argv.slice(2);
	if (
		!command ||
		command === "--help" ||
		command === "-h" ||
		command === "help"
	) {
		printHelp();
		return;
	}
	const { global, rest } = parseGlobal(raw);

	switch (command) {
		case "validate":
			return cmdValidate(global);
		case "package":
			return cmdPackage(global);
		case "version-guard":
			return cmdVersionGuard(global);
		case "publish":
			return cmdPublish(global, rest);
		case "generate-schema":
			return cmdGenerateSchema(global);
		default:
			console.error(`Unknown command: ${command}`);
			printHelp();
			exit(1);
	}
}

async function cmdValidate(g: GlobalOpts): Promise<void> {
	const result = await validatePlugin({ root: g.root, pluginDir: g.pluginDir });
	if (!result.ok) {
		console.error(`\n✗ ${result.violations.length} validation violation(s):\n`);
		for (const v of result.violations) {
			console.error(`  [${v.rule}] ${v.file}`);
			console.error(`    ${v.detail}\n`);
		}
		exit(1);
	}
	console.log(`✓ Plugin "${result.name}" v${result.version} — validated.`);
}

async function cmdPackage(g: GlobalOpts): Promise<void> {
	const result = await packagePlugin({ root: g.root, pluginDir: g.pluginDir });
	console.log("✓ Cleaned and recreated dist/");
	console.log(`✓ Staged ${result.fileCount} files → dist/${result.slug}/`);
	console.log("✓ Generated dist/<slug>/package.json (runtime deps)");
	console.log(`✓ Manifest → ${relTo(g, result.manifestPath)}`);
	console.log(`✓ Tarball  → ${relTo(g, result.tarballPath)}`);
}

async function cmdVersionGuard(g: GlobalOpts): Promise<void> {
	const result = await versionGuard({ root: g.root, pluginDir: g.pluginDir });
	if (!result.ok) {
		console.error(`✗ ${result.message}`);
		exit(1);
	}
	console.log(`✓ ${result.message}`);
}

async function cmdPublish(g: GlobalOpts, rest: string[]): Promise<void> {
	const url = opt(rest, "url") ?? process.env.ORGSDK_CATALOG_URL ?? "";
	const token = opt(rest, "token") ?? process.env.ORGSDK_PUBLISH_TOKEN;
	const publish = flag(rest, "publish");
	if (!url) {
		console.error(
			"Catalog URL required: pass --url <url> or set ORGSDK_CATALOG_URL",
		);
		exit(1);
	}
	const result = await publishPlugin({
		root: g.root,
		pluginDir: g.pluginDir,
		url,
		token,
		publish,
	});
	console.log(
		`  ${result.slug} v${result.version} — ${result.fileCount} files staged`,
	);
	console.log(`  Target: ${result.target}`);
	if (result.dryRun) {
		console.log("\n--dry-run (or no --publish flag): not posting to catalog.");
		console.log(
			"  To publish: add --publish and ensure ORGSDK_PUBLISH_TOKEN is set.",
		);
		return;
	}
	console.log(`Published: ${result.response ?? ""}`);
}

async function cmdGenerateSchema(g: GlobalOpts): Promise<void> {
	await writeManifestJsonSchema(`${g.root}/${SCHEMA_PATH}`);
	console.log(`✓ Generated ${SCHEMA_PATH}`);
}

function relTo(g: GlobalOpts, abs: string): string {
	return abs.startsWith(g.root) ? abs.slice(g.root.length + 1) : abs;
}

function printHelp(): void {
	console.log(`orgsdk-plugin — OrgSDK plugin authoring SDK

Usage: orgsdk-plugin <command> [options]

Commands:
  validate        Validate manifest, entry point, source isolation
  package         Build deterministic artifact + checksum
  version-guard   Check version sync + content-change bump
  publish         Dry-run (default) or publish to catalog
  generate-schema Regenerate the committed JSON Schema

Options:
  --root <dir>        Repository root (default: cwd)
  --plugin-dir <dir>  Plugin source directory (default: <root>/plugin)
  --url <url>         Catalog URL (publish; or ORGSDK_CATALOG_URL)
  --token <token>     Catalog token (publish; or ORGSDK_PUBLISH_TOKEN)
  --publish           Actually publish (default: dry-run)
  -h, --help          Show this help`);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : String(err));
	exit(1);
});
