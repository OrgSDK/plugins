/**
 * Regression tests for the canonical marketplace metadata coverage.
 *
 * These fixtures mirror the real marketplace shapes used by the official
 * OrgSDK plugin manifests (github, google-sheets, google-tasks). Before the
 * 0.2.1 schema expansion these would have been REJECTED by the strict SDK
 * schema (links.sourceRepo, group, screenshots, seoOverview, minRuntimeVersion)
 * — forcing the platform to skip marketplace validation via a workaround. They
 * now validate canonically, eliminating that workaround's justification.
 */
import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { safeParsePluginManifest } from "../src/manifest";

const FIXTURE_DIR = resolve(import.meta.dir, "fixtures", "marketplace");

async function loadFixture(slug: string): Promise<unknown> {
	return JSON.parse(await readFile(join(FIXTURE_DIR, `${slug}.json`), "utf-8"));
}

describe("marketplace regression fixtures", () => {
	it("every fixture in the directory validates against the canonical schema", async () => {
		const files = await readdir(FIXTURE_DIR);
		const jsonFiles = files.filter((f) => f.endsWith(".json"));
		expect(jsonFiles.length).toBeGreaterThanOrEqual(3);
		for (const file of jsonFiles) {
			const slug = file.replace(/\.json$/, "");
			const result = safeParsePluginManifest(await loadFixture(slug));
			if (!result.success) {
				throw new Error(`${slug}: ${result.error}`);
			}
			expect(result.success, slug).toBe(true);
		}
	});

	it("github: validates with links.sourceRepo (canonical key)", async () => {
		const data = safeParsePluginManifest(await loadFixture("github"));
		expect(data.success).toBe(true);
		if (!data.success) return;
		expect(data.data.marketplace?.links?.sourceRepo).toBe(
			"https://github.com/octokit/octokit.js",
		);
		expect(data.data.marketplace?.links?.homepage).toBe("https://github.com");
	});

	it("google-sheets: validates group, seoOverview, screenshots, minRuntimeVersion", async () => {
		const data = safeParsePluginManifest(await loadFixture("google-sheets"));
		expect(data.success).toBe(true);
		if (!data.success) return;
		const mp = data.data.marketplace;
		expect(mp?.group).toBe("google");
		expect(mp?.seoOverview).toEqual({
			heading: "Integrate AI agents with Google Sheets",
			paragraph: expect.any(String),
		});
		expect(mp?.screenshots).toEqual([]);
		expect(mp?.minRuntimeVersion).toBe("0.0.0");
	});

	it("google-tasks: validates group + shared-credential links", async () => {
		const data = safeParsePluginManifest(await loadFixture("google-tasks"));
		expect(data.success).toBe(true);
		if (!data.success) return;
		expect(data.data.marketplace?.group).toBe("google");
		expect(data.data.marketplace?.links?.docs).toBe(
			"https://developers.google.com/tasks/reference/rest",
		);
	});
});

describe("marketplace strict nested validation", () => {
	const BASE = {
		name: "strict-mp",
		version: "1.0.0",
		description: "d",
	};

	it("accepts the repository link alias alongside sourceRepo", () => {
		const result = safeParsePluginManifest({
			...BASE,
			marketplace: {
				links: {
					sourceRepo: "https://github.com/x/y",
					repository: "https://github.com/x/y",
				},
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects an unknown marketplace field (strict)", () => {
		const result = safeParsePluginManifest({
			...BASE,
			marketplace: { displayName: "X", bogus: true },
		});
		expect(result.success).toBe(false);
	});

	it("rejects an unknown link key (strict nested)", () => {
		const result = safeParsePluginManifest({
			...BASE,
			marketplace: { links: { wiki: "https://x" } },
		});
		expect(result.success).toBe(false);
	});

	it("rejects seoOverview missing a required key", () => {
		const result = safeParsePluginManifest({
			...BASE,
			marketplace: { seoOverview: { heading: "H" } },
		});
		expect(result.success).toBe(false);
	});

	it("rejects seoOverview with an unknown key", () => {
		const result = safeParsePluginManifest({
			...BASE,
			marketplace: {
				seoOverview: { heading: "H", paragraph: "P", extra: "x" },
			},
		});
		expect(result.success).toBe(false);
	});

	it("rejects a non-semver minRuntimeVersion", () => {
		const result = safeParsePluginManifest({
			...BASE,
			marketplace: { minRuntimeVersion: "1.0" },
		});
		expect(result.success).toBe(false);
	});

	it("rejects a non-URL screenshot", () => {
		const result = safeParsePluginManifest({
			...BASE,
			marketplace: { screenshots: ["not-a-url"] },
		});
		expect(result.success).toBe(false);
	});

	it("rejects non-URL privacy/terms links", () => {
		const r1 = safeParsePluginManifest({
			...BASE,
			marketplace: { links: { privacy: "nope" } },
		});
		expect(r1.success).toBe(false);
		const r2 = safeParsePluginManifest({
			...BASE,
			marketplace: { links: { terms: "nope" } },
		});
		expect(r2.success).toBe(false);
	});
});
