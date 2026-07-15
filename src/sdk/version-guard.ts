/**
 * Version synchronization + content-bump guard (library API).
 *
 * Two checks:
 *
 * 1. Version-sync invariant (always): the root package.json `version` must
 *    equal the manifest `version`. They are the same logical release.
 *
 * 2. Content-bump gate (needs BASE_REF): if publishable artifact content
 *    changed relative to BASE_REF, the manifest `version` must also change.
 *    Publishable content = plugin/** + package.json name/type/dependencies.
 *    Docs, tests, workflows, README, scripts, and devDependency-only
 *    package.json edits do NOT require a bump.
 */

import { join } from "node:path";
import { readJsonFile } from "./fs";
import { changedFiles, resolveBase, showJson } from "./git";

interface Versioned {
	version: string;
}

interface RootPkg {
	name?: string;
	type?: string;
	dependencies?: Record<string, string>;
}

export interface VersionGuardOptions {
	root: string;
	pluginDir: string;
}

export interface VersionGuardResult {
	ok: boolean;
	/** Human-readable summary (one line on success, multi-line on failure). */
	message: string;
}

export async function versionGuard(
	opts: VersionGuardOptions,
): Promise<VersionGuardResult> {
	const manifest = await readJsonFile<Versioned>(
		join(opts.pluginDir, ".plugin.json"),
	);
	const pkg = await readJsonFile<RootPkg & Versioned>(
		join(opts.root, "package.json"),
	);

	if (manifest.version !== pkg.version) {
		return {
			ok: false,
			message:
				`version-sync: package.json (${pkg.version}) != manifest (${manifest.version}).\n` +
				"Bump both together — they record the same release.",
		};
	}

	const base = resolveBase(opts.root);
	if (!base) {
		return {
			ok: true,
			message: `version-sync ok (${manifest.version}). No BASE_REF — content-bump gate skipped.`,
		};
	}

	const changed = changedFiles(opts.root, base);
	const pluginChanged = changed.some((f) => f.startsWith("plugin/"));
	const pkgChanged = changed.includes("package.json");

	let requiresBump = pluginChanged;
	const reasons: string[] = [];
	if (pluginChanged) reasons.push("plugin/** changed");

	if (pkgChanged) {
		const basePkg = showJson<RootPkg>(opts.root, base, "package.json");
		if (artifactPkgChanged(basePkg, pkg)) {
			requiresBump = true;
			reasons.push("package.json name/type/dependencies changed");
		}
	}

	if (!requiresBump) {
		return {
			ok: true,
			message: `version-sync ok (${manifest.version}). No publishable content changed (${changed.length} file(s) touched).`,
		};
	}

	const baseManifest = showJson<Versioned>(
		opts.root,
		base,
		"plugin/.plugin.json",
	);
	const baseVersion = baseManifest?.version ?? "";

	if (manifest.version === baseVersion) {
		return {
			ok: false,
			message:
				`version-bump required: publishable content changed but manifest version is unchanged at ${manifest.version}.\n` +
				`Reason: ${reasons.join("; ")}.\n` +
				"Bump plugin/.plugin.json version (and package.json).",
		};
	}

	return {
		ok: true,
		message: `version-sync ok; content changed (${reasons.join("; ")}) → version bumped ${baseVersion || "∅"} → ${manifest.version}.`,
	};
}

/** Whether a package.json diff affects the generated artifact package.json. */
function artifactPkgChanged(
	basePkg: RootPkg | undefined,
	headPkg: RootPkg | undefined,
): boolean {
	const norm = (p: RootPkg | undefined) => ({
		name: p?.name ?? "",
		type: p?.type ?? "",
		dependencies: p?.dependencies ?? {},
	});
	return JSON.stringify(norm(basePkg)) !== JSON.stringify(norm(headPkg));
}
