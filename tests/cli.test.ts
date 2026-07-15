import { describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { VERSION } from "../src/version";

const CLI = resolve(import.meta.dir, "..", "src", "cli.ts");
const FIXTURE_ROOT = resolve(import.meta.dir, "fixtures");
const PLUGIN_DIR = join(FIXTURE_ROOT, "sample-plugin");
const DIST = join(FIXTURE_ROOT, "dist");

function run(args: string[]): { code: number; stdout: string; stderr: string } {
	const r = Bun.spawnSync(["bun", CLI, ...args], {
		cwd: FIXTURE_ROOT,
		stdio: ["ignore", "pipe", "pipe"],
	});
	return {
		code: r.exitCode,
		stdout: r.stdout?.toString() ?? "",
		stderr: r.stderr?.toString() ?? "",
	};
}

describe("orgsdk-plugin CLI", () => {
	it("prints help and exits 0 with no command", async () => {
		const r = run([]);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("orgsdk-plugin");
		expect(r.stdout).toContain("validate");
		await rm(DIST, { recursive: true, force: true });
	});

	it("rejects an unknown command", async () => {
		const r = run(["bogus"]);
		expect(r.code).toBe(1);
		expect(r.stderr).toContain("Unknown command");
		await rm(DIST, { recursive: true, force: true });
	});

	it("validate succeeds on the sample fixture", async () => {
		const r = run(["validate", "--plugin-dir", PLUGIN_DIR]);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("validated");
		await rm(DIST, { recursive: true, force: true });
	});

	it("package stages the artifact", async () => {
		try {
			const r = run(["package", "--plugin-dir", PLUGIN_DIR]);
			expect(r.code).toBe(0);
			expect(r.stdout).toContain("Staged");
			expect(r.stdout).toContain("Tarball");
		} finally {
			await rm(DIST, { recursive: true, force: true });
		}
	});

	it("version-guard passes with matching versions", async () => {
		const r = run(["version-guard", "--plugin-dir", PLUGIN_DIR]);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("version-sync ok");
		await rm(DIST, { recursive: true, force: true });
	});

	it("publish dry-run does not POST", async () => {
		try {
			const r = run([
				"publish",
				"--plugin-dir",
				PLUGIN_DIR,
				"--url",
				"https://catalog.example",
			]);
			expect(r.code).toBe(0);
			expect(r.stdout).toContain("--dry-run");
		} finally {
			await rm(DIST, { recursive: true, force: true });
		}
	});

	it("publish without a URL fails clearly", async () => {
		const r = run(["publish", "--plugin-dir", PLUGIN_DIR]);
		expect(r.code).toBe(1);
		expect(r.stderr).toContain("Catalog URL required");
		await rm(DIST, { recursive: true, force: true });
	});

	it("generate-schema regenerates the committed schema", async () => {
		const tmpRoot = resolve(import.meta.dir, ".tmp", `gen-${Date.now()}`);
		try {
			const r = run(["generate-schema", "--root", tmpRoot]);
			expect(r.code).toBe(0);
			expect(r.stdout).toContain("Generated");
			expect(VERSION).toBe("0.2.1");
		} finally {
			await rm(tmpRoot, { recursive: true, force: true });
			await rm(DIST, { recursive: true, force: true });
		}
	});
});
