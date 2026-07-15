import { describe, expect, it } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { collectFiles, readJsonFile } from "../src/sdk/fs";
import { packagePlugin } from "../src/sdk/package";

const FIXTURE_ROOT = resolve(import.meta.dir, "fixtures");
const PLUGIN_DIR = join(FIXTURE_ROOT, "sample-plugin");

async function withCleanDist<T>(fn: () => Promise<T>): Promise<T> {
	const dist = join(FIXTURE_ROOT, "dist");
	await rm(dist, { recursive: true, force: true });
	try {
		return await fn();
	} finally {
		await rm(dist, { recursive: true, force: true });
	}
}

describe("packagePlugin", () => {
	it("stages files, generates package.json, checksum manifest, and tarball", async () => {
		await withCleanDist(async () => {
			const result = await packagePlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
			});
			expect(result.slug).toBe("sample");
			expect(result.version).toBe("0.4.2");
			expect(result.fileCount).toBeGreaterThan(0);

			const stagedPkg = await readJsonFile<{
				name: string;
				version: string;
				dependencies?: Record<string, string>;
			}>(join(result.stagedDir, "package.json"));
			expect(stagedPkg.name).toBe("@orgsdk/plugin-sample");
			expect(stagedPkg.version).toBe("0.4.2");
			expect(stagedPkg.dependencies?.zod).toBe("^4.0.0");

			const manifest = await readJsonFile<{
				slug: string;
				version: string;
				fileCount: number;
				files: Array<{ path: string; sha256: string; size: number }>;
			}>(result.manifestPath);
			expect(manifest.slug).toBe("sample");
			expect(manifest.files.length).toBe(result.fileCount);
			for (const f of manifest.files) {
				expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
				expect(f.size).toBeGreaterThanOrEqual(0);
			}
		});
	});

	it("is deterministic: two runs produce identical checksums", async () => {
		await withCleanDist(async () => {
			const a = await packagePlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
			});
			const manifestA = await readFile(a.manifestPath, "utf-8");
			const b = await packagePlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
			});
			const manifestB = await readFile(b.manifestPath, "utf-8");
			expect(manifestA).toBe(manifestB);
		});
	});

	it("removes stale files from a previous build", async () => {
		await withCleanDist(async () => {
			const first = await packagePlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
			});
			const stalePath = join(first.stagedDir, "STALE.ts");
			await writeFile(stalePath, "export const stale = true;\n");

			const second = await packagePlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
			});
			const files = await collectFiles(second.stagedDir);
			expect(files.some((f) => f.rel === "STALE.ts")).toBe(false);
		});
	});

	it("rejects an invalid manifest", async () => {
		await withCleanDist(async () => {
			const tmp = await makeBadPlugin();
			await expect(
				packagePlugin({ root: tmp.root, pluginDir: tmp.dir }),
			).rejects.toThrow(/Invalid manifest/);
			await rm(tmp.root, { recursive: true, force: true });
		});
	});
});

async function makeBadPlugin(): Promise<{ root: string; dir: string }> {
	const root = resolve(import.meta.dir, ".tmp", `bad-${Date.now()}`);
	const dir = join(root, "plugin");
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, ".plugin.json"),
		`${JSON.stringify({ name: "bad", version: "not-semver", description: "x" }, null, "\t")}\n`,
	);
	await writeFile(
		join(root, "package.json"),
		'{"name":"bad","version":"0.1.0"}\n',
	);
	return { root, dir };
}
