/**
 * Deterministic filesystem + path helpers for the plugin SDK mechanics.
 *
 * All traversal is sorted by name so staging, checksums, and archive order are
 * reproducible across runs and machines. No shell — pure node:fs.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

/** Default plugin source directory relative to the repository root. */
export const DEFAULT_PLUGIN_DIR = "plugin";

/** Manifest filename inside the plugin directory. */
export const MANIFEST_FILE = ".plugin.json";

/** Resolve the repository root (default: process.cwd()). */
export function resolveRoot(explicit?: string): string {
	return resolve(explicit ?? process.cwd());
}

/** Resolve the plugin directory (default: <root>/plugin). */
export function resolvePluginDir(root: string, explicit?: string): string {
	return resolve(explicit ?? join(root, DEFAULT_PLUGIN_DIR));
}

/** Path to the manifest file inside a plugin directory. */
export function manifestPath(pluginDir: string): string {
	return join(pluginDir, MANIFEST_FILE);
}

/** Read + JSON.parse a file, throwing a clear error on failure. */
export async function readJsonFile<T>(path: string): Promise<T> {
	const raw = await readFile(path, "utf-8");
	try {
		return JSON.parse(raw) as T;
	} catch (err) {
		throw new Error(
			`Invalid JSON in ${path}: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

/** Read the raw manifest JSON object from a plugin directory. */
export async function readManifestRaw(pluginDir: string): Promise<unknown> {
	return readJsonFile<unknown>(manifestPath(pluginDir));
}

export interface CollectedFile {
	/** Absolute filesystem path. */
	abs: string;
	/** Path relative to the walked root, using POSIX separators. */
	rel: string;
	/** Raw byte content. */
	content: Buffer;
}

/**
 * Recursively collect regular files under `dir`, sorted by relative path for
 * determinism. Skips `node_modules`, `.git`, and `dist`.
 */
export async function collectFiles(dir: string): Promise<CollectedFile[]> {
	const out: CollectedFile[] = [];
	await walk(dir, dir, out);
	out.sort((a, b) => a.rel.localeCompare(b.rel));
	return out;
}

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist"]);

async function walk(
	root: string,
	current: string,
	out: CollectedFile[],
): Promise<void> {
	const entries = await readdir(current, { withFileTypes: true });
	entries.sort((a, b) => a.name.localeCompare(b.name));
	for (const entry of entries) {
		const abs = join(current, entry.name);
		if (entry.isDirectory()) {
			if (IGNORED_DIRS.has(entry.name)) continue;
			await walk(root, abs, out);
		} else if (entry.isFile()) {
			const content = await readFile(abs);
			out.push({
				abs,
				rel: relative(root, abs).split("\\").join("/"),
				content,
			});
		}
	}
}

/** Whether `path` exists (file or directory). */
export async function pathExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/** Whether `path` is a regular file. */
export async function isFile(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
}
