import assert from "node:assert/strict";
import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = join(
	dirname(fileURLToPath(import.meta.url)),
	"plugin-ci-templates",
);
const root = resolve(
	process.argv.find((arg) => arg.startsWith("--root="))?.slice(7) ?? "..",
);
const check = process.argv.includes("--check");
const repositories = process.argv
	.find((arg) => arg.startsWith("--repos="))
	?.slice(8)
	.split(",");
const mapping = {
	"build-npm.mjs": "scripts/build-npm.mjs",
	"test-executor.mjs": "scripts/test-executor.mjs",
	"npm-pack.test.mjs": "tests/npm-pack.test.mjs",
	"test-registration.mjs": "scripts/test-registration.mjs",
	"ci.yml": ".github/workflows/ci.yml",
	"publish-npm.yml": ".github/workflows/publish-npm.yml",
	"executor.patch": "patches/@orgsdk%2Fexecutor@0.1.0.patch",
	"npm-distribution.md": "docs/npm-distribution.md",
};
let count = 0;
for (const entry of await readdir(root, { withFileTypes: true })) {
	if (!entry.isDirectory() || !entry.name.startsWith("orgsdk-plugin-"))
		continue;
	if (repositories && !repositories.includes(entry.name)) continue;
	const repository = join(root, entry.name);
	for (const [template, target] of Object.entries(mapping)) {
		const destination = join(repository, target);
		if (check)
			assert.equal(
				await readFile(destination, "utf8"),
				await readFile(join(source, template), "utf8"),
				`${entry.name}/${target} differs from its template`,
			);
		else {
			await mkdir(dirname(destination), { recursive: true });
			await copyFile(join(source, template), destination);
		}
	}
	count++;
}
console.log(
	`${check ? "Verified" : "Synchronized"} npm/executor CI files in ${count} plugin repositories`,
);
