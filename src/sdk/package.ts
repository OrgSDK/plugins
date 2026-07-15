/**
 * Deterministic artifact staging (library API).
 *
 * Steps:
 *   1. Remove dist/ entirely (node:fs rm — no shell, no stale files survive).
 *   2. Copy plugin/ → dist/<slug>/ (sorted traversal for determinism).
 *   3. Generate a minimal package.json in dist/<slug>/ carrying the plugin's
 *      runtime dependencies (the catalog reads this to resolve deps).
 *   4. Write a checksum manifest (sorted entries, content-addressed).
 *   5. Produce a tarball (sorted file order, safe argv — no shell injection).
 *
 * No network calls, no catalog publishing — purely local staging.
 */

import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { $ } from "bun";
import { safeParsePluginManifest } from "../manifest";
import { collectFiles, readJsonFile } from "./fs";

export interface FileEntry {
	path: string;
	size: number;
	sha256: string;
}

export interface PackageOptions {
	root: string;
	pluginDir: string;
	/** Output directory. Defaults to <root>/dist. */
	distDir?: string;
}

export interface PackageResult {
	slug: string;
	version: string;
	stagedDir: string;
	manifestPath: string;
	tarballPath: string;
	fileCount: number;
}

interface RootPkg {
	name?: string;
	type?: string;
	dependencies?: Record<string, string>;
}

export async function packagePlugin(
	opts: PackageOptions,
): Promise<PackageResult> {
	const raw = await readJsonFile<unknown>(join(opts.pluginDir, ".plugin.json"));
	const parsed = safeParsePluginManifest(raw);
	if (!parsed.success) {
		throw new Error(`Invalid manifest:\n${parsed.error}`);
	}
	const slug = parsed.data.name;
	const version = parsed.data.version;
	const rootPkg = await readJsonFile<RootPkg>(join(opts.root, "package.json"));

	const distDir = opts.distDir ?? join(opts.root, "dist");
	await rm(distDir, { recursive: true, force: true });
	await mkdir(distDir, { recursive: true });

	const stagedDir = join(distDir, slug);
	await mkdir(stagedDir, { recursive: true });

	const entries: FileEntry[] = [];
	for (const f of await collectFiles(opts.pluginDir)) {
		const dest = join(stagedDir, f.rel);
		await mkdir(resolve(dest, ".."), { recursive: true });
		await writeFile(dest, f.content);
		entries.push({
			path: f.rel,
			size: f.content.length,
			sha256: createHash("sha256").update(f.content).digest("hex"),
		});
	}

	const pluginPkgJson = await generatePackageJson(rootPkg, version);
	await writeFile(join(stagedDir, "package.json"), pluginPkgJson);
	entries.push({
		path: "package.json",
		size: pluginPkgJson.length,
		sha256: createHash("sha256").update(pluginPkgJson).digest("hex"),
	});

	entries.sort((a, b) => a.path.localeCompare(b.path));

	const manifestPath = join(distDir, `${slug}-${version}.manifest.json`);
	await writeFile(
		manifestPath,
		`${JSON.stringify({ slug, version, fileCount: entries.length, files: entries }, null, "\t")}\n`,
	);

	const tarballPath = join(distDir, `${slug}-${version}.tgz`);
	await createTarball(
		stagedDir,
		tarballPath,
		entries.map((e) => e.path),
	);

	return {
		slug,
		version,
		stagedDir,
		manifestPath,
		tarballPath,
		fileCount: entries.length,
	};
}

/**
 * Minimal package.json for the staged plugin folder. Includes only production
 * dependencies — no devDependencies, no scripts, no private flag. The catalog's
 * readPluginFolder reads `dependencies` to resolve runtime deps at materialise
 * time (runtime dependency parity).
 */
async function generatePackageJson(
	rootPkg: RootPkg,
	version: string,
): Promise<string> {
	const pluginPkg: Record<string, unknown> = {
		name: rootPkg.name ?? "",
		version,
		type: rootPkg.type ?? "module",
	};
	if (rootPkg.dependencies && Object.keys(rootPkg.dependencies).length > 0) {
		pluginPkg.dependencies = rootPkg.dependencies;
	}
	return `${JSON.stringify(pluginPkg, null, "\t")}\n`;
}

/**
 * Create a gzip tarball with a sorted file list. Bun's tagged template passes
 * each interpolated value as a separate argv entry (never a shell string), so
 * file names cannot inject shell commands.
 */
async function createTarball(
	stagedDir: string,
	tarball: string,
	fileList: string[],
): Promise<void> {
	await $`tar -czf ${tarball} -C ${stagedDir} ${fileList}`.quiet();
}

/** Read staged files as { path, content } for catalog publication. */
export async function readStagedFiles(
	stagedDir: string,
): Promise<Array<{ path: string; content: string }>> {
	const out: Array<{ path: string; content: string }> = [];
	for (const f of await collectFiles(stagedDir)) {
		out.push({ path: f.rel, content: f.content.toString("utf-8") });
	}
	return out;
}
