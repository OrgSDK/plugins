import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("template sync targets selected repositories and detects runner/test drift", async () => {
	const root = await mkdtemp(join(tmpdir(), "orgsdk-ci-sync-"));
	const sync = fileURLToPath(
		new URL("../scripts/sync-plugin-ci.mjs", import.meta.url),
	);
	const selected = join(root, "orgsdk-plugin-selected");
	const untouched = join(root, "orgsdk-plugin-untouched");
	const args = [sync, `--root=${root}`, "--repos=orgsdk-plugin-selected"];
	try {
		await mkdir(selected);
		await mkdir(untouched);
		execFileSync(process.execPath, args);
		assert.equal(existsSync(join(untouched, "scripts")), false);
		for (const file of ["scripts/test-executor.mjs", "tests/npm-pack.test.mjs"])
			assert((await readFile(join(selected, file), "utf8")).length > 0);
		execFileSync(process.execPath, [...args, "--check"]);
		for (const file of [
			"scripts/test-executor.mjs",
			"tests/npm-pack.test.mjs",
		]) {
			const original = await readFile(join(selected, file), "utf8");
			await writeFile(join(selected, file), `${original}\n// drift\n`);
			assert.throws(() =>
				execFileSync(process.execPath, [...args, "--check"], { stdio: "pipe" }),
			);
			await writeFile(join(selected, file), original);
		}
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
