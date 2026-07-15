import { describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validatePlugin } from "../src/sdk/validate";

const FIXTURE_ROOT = resolve(import.meta.dir, "fixtures");
const PLUGIN_DIR = join(FIXTURE_ROOT, "sample-plugin");

describe("validatePlugin", () => {
	it("passes on the sample fixture", async () => {
		const result = await validatePlugin({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
		});
		expect(result.ok).toBe(true);
		expect(result.name).toBe("sample");
		expect(result.version).toBe("0.4.2");
	});

	it("reports a missing manifest", async () => {
		const tmp = await tempPluginDir("empty");
		const result = await validatePlugin({ root: tmp.root, pluginDir: tmp.dir });
		expect(result.ok).toBe(false);
		expect(
			result.violations.some((v) => v.rule === "manifest-unreadable"),
		).toBe(true);
		await rm(tmp.root, { recursive: true, force: true });
	});

	it("reports an invalid manifest (missing required field)", async () => {
		const tmp = await tempPlugin("bad", {
			name: "bad",
			version: "1.0.0",
			description: "x",
			entry: "index.ts",
			customField: 1,
		});
		const result = await validatePlugin({ root: tmp.root, pluginDir: tmp.dir });
		expect(result.ok).toBe(false);
		expect(result.violations.some((v) => v.rule === "manifest-schema")).toBe(
			true,
		);
		await rm(tmp.root, { recursive: true, force: true });
	});

	it("reports a missing entry file", async () => {
		const tmp = await tempPlugin("noentry", {
			name: "noentry",
			version: "1.0.0",
			description: "x",
			entry: "missing.ts",
		});
		const result = await validatePlugin({ root: tmp.root, pluginDir: tmp.dir });
		expect(result.ok).toBe(false);
		expect(result.violations.some((v) => v.rule === "entry-missing")).toBe(
			true,
		);
		await rm(tmp.root, { recursive: true, force: true });
	});

	it("reports a forbidden internal import", async () => {
		const tmp = await tempPlugin("forbidden", {
			name: "forbidden",
			version: "1.0.0",
			description: "x",
			entry: "index.ts",
		});
		await writeFile(
			join(tmp.dir, "index.ts"),
			'import { x } from "@orgsdk/daemon";\n',
		);
		const result = await validatePlugin({ root: tmp.root, pluginDir: tmp.dir });
		expect(result.ok).toBe(false);
		expect(result.violations.some((v) => v.rule === "forbidden-import")).toBe(
			true,
		);
		await rm(tmp.root, { recursive: true, force: true });
	});

	it("reports a value import from @orgsdk/plugins", async () => {
		const tmp = await tempPlugin("valueimport", {
			name: "valueimport",
			version: "1.0.0",
			description: "x",
			entry: "index.ts",
		});
		await writeFile(
			join(tmp.dir, "index.ts"),
			'import { z } from "@orgsdk/plugins";\n',
		);
		const result = await validatePlugin({ root: tmp.root, pluginDir: tmp.dir });
		expect(result.ok).toBe(false);
		expect(result.violations.some((v) => v.rule === "sdk-value-import")).toBe(
			true,
		);
		await rm(tmp.root, { recursive: true, force: true });
	});

	it("allows type-only imports from @orgsdk/plugins", async () => {
		const tmp = await tempPlugin("typeonly", {
			name: "typeonly",
			version: "1.0.0",
			description: "x",
			entry: "index.ts",
		});
		await writeFile(
			join(tmp.dir, "index.ts"),
			'import type { SafeFunction } from "@orgsdk/plugins";\n',
		);
		const result = await validatePlugin({ root: tmp.root, pluginDir: tmp.dir });
		expect(result.ok).toBe(true);
		await rm(tmp.root, { recursive: true, force: true });
	});
});

/** Create a plugin dir with a manifest. */
async function tempPlugin(
	slug: string,
	manifest: Record<string, unknown>,
): Promise<{ root: string; dir: string }> {
	const { root, dir } = await tempPluginDir(slug);
	await writeFile(
		join(dir, ".plugin.json"),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);
	return { root, dir };
}

/** Create an empty plugin dir (no manifest). */
async function tempPluginDir(
	slug: string,
): Promise<{ root: string; dir: string }> {
	const root = resolve(import.meta.dir, ".tmp", `${slug}-${Date.now()}`);
	const dir = join(root, "plugin");
	await mkdir(dir, { recursive: true });
	return { root, dir };
}
