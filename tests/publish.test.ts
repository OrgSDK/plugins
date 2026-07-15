import { afterEach, describe, expect, it, mock } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { publishPlugin } from "../src/sdk/publish";

const FIXTURE_ROOT = resolve(import.meta.dir, "fixtures");
const PLUGIN_DIR = join(FIXTURE_ROOT, "sample-plugin");
const DIST = join(FIXTURE_ROOT, "dist");

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(async () => {
	globalThis.fetch = ORIGINAL_FETCH;
	await rm(DIST, { recursive: true, force: true });
});

describe("publishPlugin — dry-run", () => {
	it("defaults to dry-run and makes no network call", async () => {
		const fetchMock = mock(() => Promise.resolve(new Response("{}")));
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const result = await publishPlugin({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
			url: "https://catalog.example",
		});

		expect(result.dryRun).toBe(true);
		expect(result.slug).toBe("sample");
		expect(result.version).toBe("0.4.2");
		expect(result.fileCount).toBeGreaterThan(0);
		expect(result.target).toBe("https://catalog.example/api/plugins");
		expect(fetchMock).toHaveBeenCalledTimes(0);
	});

	it("does not require a token in dry-run", async () => {
		const result = await publishPlugin({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
			url: "https://catalog.example",
		});
		expect(result.dryRun).toBe(true);
	});
});

describe("publishPlugin — real publish", () => {
	it("requires a token when publishing", async () => {
		await expect(
			publishPlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
				url: "https://catalog.example",
				publish: true,
			}),
		).rejects.toThrow(/requires auth/);
	});

	it("sends the token only in the Authorization header", async () => {
		const SECRET = "super-secret-token-12345";
		let capturedHeaders: Headers | undefined;
		let capturedBody: string | undefined;
		globalThis.fetch = (async (
			_url: string | URL | Request,
			init?: RequestInit,
		) => {
			capturedHeaders = new Headers(init?.headers);
			capturedBody = String(init?.body ?? "");
			return new Response('{"ok":true}', { status: 200 });
		}) as unknown as typeof fetch;

		const result = await publishPlugin({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
			url: "https://catalog.example",
			token: SECRET,
			publish: true,
		});

		expect(result.dryRun).toBe(false);
		expect(result.response).toBe('{"ok":true}');
		expect(capturedHeaders?.get("authorization")).toBe(`Bearer ${SECRET}`);
		// The token must never appear in the request body.
		expect(capturedBody?.includes(SECRET)).toBe(false);
	});

	it("never surfaces the token in an error message", async () => {
		const SECRET = "leak-me-if-you-can-999";
		globalThis.fetch = (async () =>
			new Response(`Error: Bearer ${SECRET} rejected`, {
				status: 409,
			})) as unknown as typeof fetch;

		await expect(
			publishPlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
				url: "https://catalog.example",
				token: SECRET,
				publish: true,
			}),
		).rejects.toThrow(/Publish failed/);
	});

	it("redacts token-like strings in error output", async () => {
		const SECRET = "do-not-leak-this-777";
		globalThis.fetch = (async () =>
			new Response(`Bearer ${SECRET}`, {
				status: 409,
			})) as unknown as typeof fetch;

		try {
			await publishPlugin({
				root: FIXTURE_ROOT,
				pluginDir: PLUGIN_DIR,
				url: "https://catalog.example",
				token: SECRET,
				publish: true,
			});
			expect.unreachable("should have thrown");
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			expect(msg).not.toContain(SECRET);
			expect(msg).toContain("***");
		}
	});

	it("strips a trailing slash from the catalog URL", async () => {
		let capturedUrl = "";
		globalThis.fetch = (async (url: string | URL | Request) => {
			capturedUrl = String(url);
			return new Response("ok", { status: 200 });
		}) as unknown as typeof fetch;

		await publishPlugin({
			root: FIXTURE_ROOT,
			pluginDir: PLUGIN_DIR,
			url: "https://catalog.example/",
			token: "t",
			publish: true,
		});
		expect(capturedUrl).toBe("https://catalog.example/api/plugins");
	});
});
