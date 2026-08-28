/**
 * Purpose:  Guard the one fact this worker states twice -- which path prefixes
 *           R2 owns -- and the key mapping built on top of it.
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

import { R2_ROUTE_PREFIXES, r2Key } from "./index.ts";

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
