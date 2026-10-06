/**
 * Purpose:  Guard the one fact this worker states twice -- which paths it
 *           owns -- and the key mapping built on top of it. Also cover the
 *           status route: what counts as "down", and the edge cache.
 *
 * Notes:    `R2_ROUTE_PREFIXES` in `index.ts` and `assets.run_worker_first` in
 *           `wrangler.jsonc` have to agree, and neither can read the other:
 *           wrangler.jsonc is config the runtime never hands to the worker, and
 *           the worker is a bundle wrangler does not parse. So the coupling is
 *           asserted here instead. Drift is silent otherwise -- a prefix in the
 *           config but not the code answers 404 from the asset router, and a
 *           prefix in the code but not the config is shadowed by any static
 *           asset sharing its name.
 *
 * Run with: npm test
 *
 * Author & Date: Nick Hobar, 08/27/2026
 */
import { deepStrictEqual, strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import worker, { R2_ROUTE_PREFIXES, r2Key } from "./index.ts";
import { STATUS_CACHE_SECONDS, parseStatus } from "./status.ts";
import { GAME_STATUS_URL, STATUS_API_PATH } from "../src/config.ts";

const WRANGLER_CONFIG = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));


/**
 * Purpose: Read `wrangler.jsonc` as data.
 *
 * Entry:   No conditions.
 *
 * Exit/Returns:
 *          The parsed config. Whole-line `//` comments are dropped first, which
 *          is the only comment form the file uses; nothing here tries to be a
 *          general JSONC parser.
 *
 * Author & Date: Nick Hobar, 08/27/2026
 */
function readWranglerConfig(): Record<string, any> {
    const source = readFileSync(WRANGLER_CONFIG, "utf8");
    const stripped = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");

    return JSON.parse(stripped);
}


describe("the R2 route prefixes", () => {
    it("match run_worker_first in wrangler.jsonc exactly", () => {
        const config = readWranglerConfig();
        const configured: string[] = config.assets.run_worker_first;

        // Two globs per prefix. `/client/*` does not match a bare `/client`,
        // and anything not matched here is answered by the asset router's 404
        // page without the worker running -- which is what made the redirect
        // in `_directoryRedirect` unreachable before this was widened.
        const expected = R2_ROUTE_PREFIXES.flatMap((prefix) => [
            prefix.slice(0, -1),
            prefix + "*",
        ]);
        expected.push(STATUS_API_PATH);

        deepStrictEqual([...configured].sort(), [...expected].sort());
    });

    it("all end in a slash, so a prefix cannot half-match a sibling path", () => {
        for (const prefix of R2_ROUTE_PREFIXES) {
            strictEqual(prefix.endsWith("/"), true, prefix);
            strictEqual(prefix.startsWith("/"), true, prefix);
        }
    });
});


describe("r2Key", () => {
    it("returns null for a path the site's own assets own", () => {
        strictEqual(r2Key("/"), null);
        strictEqual(r2Key("/play"), null);
        strictEqual(r2Key("/blog/some-post/"), null);
    });

    it("strips the leading slash so the key mirrors the URL", () => {
        strictEqual(r2Key("/client/index.wasm"), "client/index.wasm");
        strictEqual(
            r2Key("/static/webclient/models/manifest.json"),
            "static/webclient/models/manifest.json",
        );
    });

    it("resolves a directory request to its index", () => {
        strictEqual(r2Key("/client/"), "client/index.html");
    });

    it("does not claim a path that merely starts with the prefix name", () => {
        strictEqual(r2Key("/clientele/index.html"), null);
    });
});


describe("parseStatus", () => {
    it("reads an online body", () => {
        deepStrictEqual(parseStatus({ online: true, players: 3 }), { online: true, players: 3 });
        deepStrictEqual(parseStatus({ online: true, players: 0 }), { online: true, players: 0 });
    });

    it("calls every other shape offline", () => {
        const offline = { online: false, players: null };
        const bodies: unknown[] = [
            null,
            "<html>530</html>",
            42,
            {},
            { online: false, players: 3 },
            { online: "true", players: 3 },
            { online: true },
            { online: true, players: -1 },
            { online: true, players: 1.5 },
            { online: true, players: "3" },
        ];

        for (const body of bodies) {
            deepStrictEqual(parseStatus(body), offline, JSON.stringify(body));
        }
    });
});


/**
 * Purpose: Run the worker's status route with a stub game server and a stub
 *          edge cache.
 *
 * Entry:   answer is what the stub `fetch` does for GAME_STATUS_URL: a
 *          Response to give, or an Error to throw.
 *
 * Exit/Returns:
 *          The worker's response, the number of probes the stub saw, and the
 *          cache map, so a case can run the route again on a warm cache.
 *
 * Author & Date: Nick Hobar, 10/06/2026
 */
async function runStatus(answer: Response | Error, store = new Map<string, Response>()) {
    const realFetch = globalThis.fetch;
    const realCaches = (globalThis as any).caches;
    let probes = 0;

    globalThis.fetch = (async (input: RequestInfo | URL) => {
        strictEqual(String(input), GAME_STATUS_URL);
        probes += 1;
        if (answer instanceof Error) {
            throw answer;
        }
        return answer.clone();
    }) as typeof fetch;

    (globalThis as any).caches = {
        default: {
            match: async (key: Request) => store.get(key.url)?.clone(),
            put: async (key: Request, value: Response) => {
                store.set(key.url, value);
            },
        },
    };

    const pending: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext;

    try {
        const request = new Request("https://playblackout.io" + STATUS_API_PATH + "?nocache=1");
        const response = await worker.fetch(request, {} as Env, ctx);
        await Promise.all(pending);

        return { response, probes, store };
    } finally {
        globalThis.fetch = realFetch;
        (globalThis as any).caches = realCaches;
    }
}


describe("the status route", () => {
    it("passes an online answer through, with the cache age", async () => {
        const { response } = await runStatus(Response.json({ online: true, players: 2 }));

        strictEqual(response.status, 200);
        deepStrictEqual(await response.json(), { online: true, players: 2 });
        strictEqual(response.headers.get("Cache-Control"), `public, max-age=${STATUS_CACHE_SECONDS}`);
    });

    it("says offline for a tunnel with no origin", async () => {
        const tunnelDown = new Response("<html>Error 1033</html>", { status: 530 });
        const { response } = await runStatus(tunnelDown);

        strictEqual(response.status, 200);
        deepStrictEqual(await response.json(), { online: false, players: null });
    });

    it("says offline when the probe throws", async () => {
        const { response } = await runStatus(new Error("timed out"));

        deepStrictEqual(await response.json(), { online: false, players: null });
    });

    it("probes one time and then answers from the cache, query string or not", async () => {
        const first = await runStatus(Response.json({ online: true, players: 1 }));
        const second = await runStatus(new Error("must not probe"), first.store);

        strictEqual(first.probes, 1);
        strictEqual(second.probes, 0);
        deepStrictEqual(await second.response.json(), { online: true, players: 1 });
    });
});
