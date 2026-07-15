/**
 * Static guard for the reusable GitHub workflow files.
 *
 * These are YAML, not TypeScript, so a dedicated test asserts the
 * non-negotiable supply-chain and safety invariants that would otherwise only
 * be caught at runtime in CI:
 *   - reusable workflows are triggered by `workflow_call`
 *   - every third-party action is pinned to a full commit SHA (no floating
 *     `@vN` tags that can be re-pointed)
 *   - least-privilege `permissions:` (no `write-all`)
 *   - frozen installs (`--frozen-lockfile`)
 *   - full git history (`fetch-depth: 0`) for the version guard
 *   - publish is serialized and never cancelled (`cancel-in-progress: false`)
 *   - the publish token is never echoed/printed
 *
 * The assertions are intentionally line/regex based (no YAML dependency) —
 * they are narrow and target exact, stable strings.
 */

import { describe, expect, it } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const WF_DIR = resolve(import.meta.dir, "..", ".github", "workflows");

async function readWorkflow(name: string): Promise<string> {
	return readFile(join(WF_DIR, name), "utf-8");
}

async function listWorkflows(): Promise<string[]> {
	const all = await readdir(WF_DIR);
	return all.filter((f) => f.endsWith(".yml")).sort();
}

/** owner/repo@<40+ hex chars>. Local (./…) and docker:// refs are allowed. */
const SHA_PIN_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+@[0-9a-f]{40,}$/;
/** Line-anchored `uses:` value (skips `uses:` mentions inside # comments). */
const USES_RE = /^\s*-?\s*uses:\s*(\S+)/gm;
/** Echo/printf/printenv of the token *value* ($VAR / ${VAR}) — a real leak. */
const TOKEN_ECHO_RE =
	/(echo|printf|printenv)\b[^\n]*\$\{?ORGSDK_PUBLISH_TOKEN\b/i;

function everyUses(src: string): string[] {
	const refs: string[] = [];
	let m: RegExpExecArray | null = USES_RE.exec(src);
	while (m !== null) {
		refs.push(m[1].replace(/["']/g, ""));
		m = USES_RE.exec(src);
	}
	return refs;
}

describe("reusable workflows — plugin-ci.yml", () => {
	it("is a workflow_call reusable workflow", async () => {
		const y = await readWorkflow("plugin-ci.yml");
		expect(y).toContain("workflow_call:");
	});

	it("declares least-privilege permissions and frozen install + full history", async () => {
		const y = await readWorkflow("plugin-ci.yml");
		expect(y).toContain("permissions:");
		expect(y).not.toContain("write-all");
		expect(y).toContain("bun install --frozen-lockfile");
		expect(y).toContain("fetch-depth: 0");
	});

	it("only invokes the caller's bun scripts (no inline plugin mechanics)", async () => {
		const y = await readWorkflow("plugin-ci.yml");
		expect(y).toContain("bun run version-guard");
		expect(y).toContain("bun run validate");
		expect(y).toContain("bun run package");
	});
});

describe("reusable workflows — plugin-publish.yml", () => {
	it("is a workflow_call reusable workflow with explicit inputs + secret", async () => {
		const y = await readWorkflow("plugin-publish.yml");
		expect(y).toContain("workflow_call:");
		expect(y).toContain("dry-run:");
		expect(y).toContain("publish-enabled:");
		expect(y).toContain("catalog-url:");
		expect(y).toContain("secrets:");
		expect(y).toContain("ORGSDK_PUBLISH_TOKEN");
	});

	it("defaults to dry-run, least-privilege perms, frozen + full history", async () => {
		const y = await readWorkflow("plugin-publish.yml");
		expect(y).toContain("default: true");
		expect(y).toContain("permissions:");
		expect(y).not.toContain("write-all");
		expect(y).toContain("bun install --frozen-lockfile");
		expect(y).toContain("fetch-depth: 0");
	});

	it("serializes publication and never cancels in-flight runs", async () => {
		const y = await readWorkflow("plugin-publish.yml");
		expect(y).toContain("concurrency:");
		expect(y).toContain("cancel-in-progress: false");
		expect(y).toContain("github.repository");
	});

	it("publishes via the orgsdk-plugin CLI", async () => {
		const y = await readWorkflow("plugin-publish.yml");
		expect(y).toContain("bunx orgsdk-plugin publish");
		expect(y).toContain("--publish");
	});
});

describe("all workflow actions are SHA-pinned", () => {
	it("uses no floating @vN tags for third-party actions", async () => {
		for (const f of await listWorkflows()) {
			const y = await readWorkflow(f);
			for (const ref of everyUses(y)) {
				if (ref.startsWith("./") || ref.startsWith("docker://")) continue;
				expect(
					SHA_PIN_RE.test(ref),
					`${f}: action "${ref}" must be pinned to a 40-char SHA`,
				).toBe(true);
				expect(ref, `${f}: "${ref}" must not use a floating tag`).not.toMatch(
					/@v\d/i,
				);
			}
		}
	});
});

describe("no workflow logs secrets", () => {
	it("never echoes the publish token value", async () => {
		for (const f of await listWorkflows()) {
			const y = await readWorkflow(f);
			expect(
				y,
				`${f}: must not echo the $ORGSDK_PUBLISH_TOKEN value`,
			).not.toMatch(TOKEN_ECHO_RE);
		}
	});
});
