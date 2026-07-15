/**
 * Safe git helpers — every call uses Bun.spawnSync with an explicit argv
 * array. No shell is spawned, so refs/file paths cannot inject commands.
 */

import { spawnSync } from "node:child_process";

export interface GitRunner {
	cwd: string;
}

/** Run git with argv; return trimmed stdout (empty string on failure). */
export function gitText(cwd: string, args: string[]): string {
	const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
	if (r.status !== 0 || r.error) return "";
	return (r.stdout ?? "").trim();
}

/** Run git with argv; return true on exit code 0. */
export function gitOk(cwd: string, args: string[]): boolean {
	const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
	return r.status === 0 && !r.error;
}

/** Whether `ref` resolves to a valid commit. */
export function commitExists(cwd: string, ref: string): boolean {
	return gitOk(cwd, ["cat-file", "-e", `${ref}^{commit}`]);
}

/** Files changed on HEAD since its merge-base with `base` (three-dot). */
export function changedFiles(cwd: string, base: string): string[] {
	const mb = gitText(cwd, ["merge-base", base, "HEAD"]);
	if (!mb) return [];
	const text = gitText(cwd, ["diff", "--name-only", mb, "HEAD"]);
	return text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
}

/** Read a JSON file at `base:relPath`, or undefined if absent/unparseable. */
export function showJson<T>(
	cwd: string,
	base: string,
	relPath: string,
): T | undefined {
	const r = spawnSync("git", ["show", `${base}:${relPath}`], {
		cwd,
		encoding: "utf-8",
	});
	if (r.status !== 0 || r.error) return undefined;
	try {
		return JSON.parse(r.stdout ?? "") as T;
	} catch {
		return undefined;
	}
}

function isZeroSha(ref: string): boolean {
	return /^0+$/.test(ref);
}

/** Resolve BASE_REF env to a usable commit, or undefined to skip the gate. */
export function resolveBase(cwd: string): string | undefined {
	const ref = (process.env.BASE_REF ?? "").trim();
	if (!ref || isZeroSha(ref)) return undefined;
	if (!commitExists(cwd, ref)) return undefined;
	return ref;
}
