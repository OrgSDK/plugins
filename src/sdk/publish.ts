/**
 * Catalog publication (library API).
 *
 * Packages the validated artifact (calling {@link packagePlugin} directly —
 * never a shell subprocess), then either prints a dry-run summary or POSTs the
 * artifact to the OrgSDK catalog API.
 *
 * Security:
 *   - Defaults to dry-run. A network write requires `publish: true` AND a token.
 *   - The token is read from options/env and placed only in the Authorization
 *     header. It is never logged, never echoed in errors, never serialized.
 *   - Write-once safety: a catalog version-conflict is reported as a clear
 *     instruction to bump the manifest/package version.
 */

import { join } from "node:path";
import { safeParsePluginManifest } from "../manifest";
import { readJsonFile } from "./fs";
import { packagePlugin, readStagedFiles } from "./package";

export interface PublishOptions {
	root: string;
	pluginDir: string;
	/** Catalog base URL (no trailing slash). */
	url: string;
	/** Catalog publisher token. Required when `publish` is true. */
	token?: string;
	/** Actually POST. Defaults to false (dry-run). */
	publish?: boolean;
	/** Override dist dir (defaults to <root>/dist). */
	distDir?: string;
}

export interface PublishResult {
	dryRun: boolean;
	slug: string;
	version: string;
	fileCount: number;
	target: string;
	/** Catalog response text on a real publish; undefined on dry-run. */
	response?: string;
}

const CATALOG_PATH = "/api/plugins";

export async function publishPlugin(
	opts: PublishOptions,
): Promise<PublishResult> {
	const pkg = await packagePlugin({
		root: opts.root,
		pluginDir: opts.pluginDir,
		distDir: opts.distDir,
	});

	const manifest = await readJsonFile<unknown>(
		join(opts.pluginDir, ".plugin.json"),
	);
	const parsed = safeParsePluginManifest(manifest);
	if (!parsed.success) {
		throw new Error(`Invalid manifest:\n${parsed.error}`);
	}

	const files = await readStagedFiles(pkg.stagedDir);
	const target = `${opts.url.replace(/\/$/, "")}${CATALOG_PATH}`;
	const payload = {
		slug: pkg.slug,
		name: pkg.slug,
		description: parsed.data.description,
		version: pkg.version,
		category: pkg.slug,
		visibility: "public" as const,
		files,
	};

	if (!opts.publish) {
		return {
			dryRun: true,
			slug: pkg.slug,
			version: pkg.version,
			fileCount: files.length,
			target,
		};
	}

	if (!opts.token) {
		throw new Error(
			"Publish requires auth: pass --token <token> or set ORGSDK_PUBLISH_TOKEN",
		);
	}

	const resp = await fetch(target, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${opts.token}`,
		},
		body: JSON.stringify(payload),
	});

	const text = await resp.text();
	if (!resp.ok) {
		throw new Error(
			`Publish failed (${resp.status}): ${redactToken(text)}\n` +
				"If the version already exists with different content, bump the version in plugin/.plugin.json.",
		);
	}

	return {
		dryRun: false,
		slug: pkg.slug,
		version: pkg.version,
		fileCount: files.length,
		target,
		response: text,
	};
}

/**
 * Strip anything that looks like a Bearer token from response text before it
 * is surfaced. Defensive: the catalog should never echo a token, but we never
 * trust a remote body to be safe to display.
 */
function redactToken(text: string): string {
	return text
		.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***")
		.replace(/(token["']?\s*[:=]\s*["']?)[A-Za-z0-9._-]+/gi, "$1***");
}
