import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { versionGuard } from "../src/sdk/version-guard";

const FIXTURE_ROOT = resolve(import.meta.dir, "fixtures");
const PLUGIN_DIR = join(FIXTURE_ROOT, "sample-plugin");

describe("versionGuard", () => {
	it("fails when package.json and manifest versions drift", async () => {
		const tmp = await makeRepo("1.0.0", "2.0.0");
		const result = await versionGuard({ root: tmp.root, pluginDir: tmp.dir });
		expect(result.ok).toBe(false);
		expect(result.message).toContain("version-sync");
		await rm(tmp.root, { recursive: true, force: true });
	});

	it("passes when versions match and no BASE_REF is set", async () => {
		const prevBase = process.env.BASE_REF;
		delete process.env.BASE_REF;
		const result = await versionGuard({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
		});
		expect(result.ok).toBe(true);
		expect(result.message).toContain("No BASE_REF");
		process.env.BASE_REF = prevBase;
	});

	it("skips the content gate when BASE_REF is a zero SHA", async () => {
		const prevBase = process.env.BASE_REF;
		process.env.BASE_REF = "0000000000000000000000000000000000000000";
		const result = await versionGuard({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
		});
		expect(result.ok).toBe(true);
		expect(result.message).toContain("No BASE_REF");
		process.env.BASE_REF = prevBase;
	});

	it("skips the content gate when BASE_REF does not resolve", async () => {
		const prevBase = process.env.BASE_REF;
		process.env.BASE_REF = "definitely-not-a-real-ref-xyz";
		const result = await versionGuard({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
		});
		expect(result.ok).toBe(true);
		expect(result.message).toContain("No BASE_REF");
		process.env.BASE_REF = prevBase;
	});
});

describe("versionGuard — content-bump gate (git)", () => {
	it("requires a bump when plugin content changes", async () => {
		const repo = await makeGitRepo();
		try {
			const prevBase = process.env.BASE_REF;
			process.env.BASE_REF = repo.base;
			// Change plugin content without bumping the version.
			await writeFile(join(repo.dir, "index.ts"), "// changed\n");
			git(repo.root, ["add", "-A"]);
			git(repo.root, ["commit", "-m", "change content"]);

			const result = await versionGuard({
				root: repo.root,
				pluginDir: repo.dir,
			});
			expect(result.ok).toBe(false);
			expect(result.message).toContain("version-bump required");
			process.env.BASE_REF = prevBase;
		} finally {
			await rm(repo.root, { recursive: true, force: true });
		}
	});

	it("passes after bumping the version on a content change", async () => {
		const repo = await makeGitRepo();
		try {
			const prevBase = process.env.BASE_REF;
			process.env.BASE_REF = repo.base;
			await writeFile(join(repo.dir, "index.ts"), "// changed\n");
			await bump(repo, "0.2.0");
			git(repo.root, ["add", "-A"]);
			git(repo.root, ["commit", "-m", "bump"]);

			const result = await versionGuard({
				root: repo.root,
				pluginDir: repo.dir,
			});
			expect(result.ok).toBe(true);
			expect(result.message).toContain("version bumped");
			process.env.BASE_REF = prevBase;
		} finally {
			await rm(repo.root, { recursive: true, force: true });
		}
	});

	it("passes when only non-publishable files change (docs)", async () => {
		const repo = await makeGitRepo();
		try {
			const prevBase = process.env.BASE_REF;
			process.env.BASE_REF = repo.base;
			await writeFile(join(repo.root, "README.md"), "# changed\n");
			git(repo.root, ["add", "-A"]);
			git(repo.root, ["commit", "-m", "docs"]);

			const result = await versionGuard({
				root: repo.root,
				pluginDir: repo.dir,
			});
			expect(result.ok).toBe(true);
			expect(result.message).toContain("No publishable content changed");
			process.env.BASE_REF = prevBase;
		} finally {
			await rm(repo.root, { recursive: true, force: true });
		}
	});
});

function git(cwd: string, args: string[]): void {
	const r = spawnSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
	if (r.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${r.stderr?.toString()}`);
	}
}

async function makeGitRepo(): Promise<{
	root: string;
	dir: string;
	base: string;
}> {
	const root = resolve(
		tmpdir(),
		`orgsdk-vg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	const dir = join(root, "plugin");
	await mkdir(dir, { recursive: true });
	git(root, ["init", "-q"]);
	git(root, ["config", "user.email", "test@example.com"]);
	git(root, ["config", "user.name", "Test"]);
	await writeFile(
		join(root, "package.json"),
		`${JSON.stringify({ name: "x", version: "0.1.0", type: "module" }, null, "\t")}\n`,
	);
	await writeFile(join(repoManifest(dir)), manifestJson("0.1.0"));
	await writeFile(join(dir, "index.ts"), "// original\n");
	git(root, ["add", "-A"]);
	git(root, ["commit", "-q", "-m", "init"]);
	const base = spawnSync("git", ["rev-parse", "HEAD"], {
		cwd: root,
		encoding: "utf-8",
	}).stdout.trim();
	return { root, dir, base };
}

function repoManifest(dir: string): string {
	return join(dir, ".plugin.json");
}

function manifestJson(version: string): string {
	return `${JSON.stringify(
		{ name: "x", version, description: "d", entry: "index.ts" },
		null,
		"\t",
	)}\n`;
}

async function bump(
	repo: { root: string; dir: string },
	version: string,
): Promise<void> {
	await writeFile(
		join(repo.root, "package.json"),
		`${JSON.stringify({ name: "x", version, type: "module" }, null, "\t")}\n`,
	);
	await writeFile(repoManifest(repo.dir), manifestJson(version));
}

async function makeRepo(
	pkgVersion: string,
	manifestVersion: string,
): Promise<{ root: string; dir: string }> {
	const root = resolve(import.meta.dir, ".tmp", `vg-${Date.now()}`);
	const dir = join(root, "plugin");
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(root, "package.json"),
		`${JSON.stringify({ name: "x", version: pkgVersion, type: "module" }, null, "\t")}\n`,
	);
	await writeFile(
		join(dir, ".plugin.json"),
		`${JSON.stringify(
			{
				name: "x",
				version: manifestVersion,
				description: "d",
				entry: "index.ts",
			},
			null,
			"\t",
		)}\n`,
	);
	return { root, dir };
}
