/**
 * Purpose:  Serve the Godot web client and its model tree out of R2, at paths
 *           on this site's own origin. Everything else falls through to the
 *           static assets Astro built.
 *
 * Notes:    WHY R2 AND NOT STATIC ASSETS. Cloudflare caps an individual static
 *           asset at 25 MiB, on the Free plan and the Paid plan alike -- it is
 *           not a tier that can be bought out of. `index.wasm` is 37.7 MiB, and
 *           `index.pck` is only 205 KB of that, so the weight is the Godot
 *           engine itself and no amount of game-side pruning reaches it.
 *
 *           WHY ON THIS ORIGIN AND NOT A BUCKET SUBDOMAIN. An R2 custom domain
 *           binds a whole hostname, so `cdn.playblackout.io` is what it would
 *           offer, and that is a DIFFERENT ORIGIN from the page. The client
 *           fetches its `.glb` models over ordinary HTTP, and unlike `wss://`
 *           that is subject to CORS. `ServerEndpoint.asset_origin()` returns
 *           `""` for a release web build precisely so those fetches stay
 *           relative and never cross an origin -- see
 *           `muddev/deploy/webexport/README.md`. Serving the bucket through
 *           this worker keeps that true, which is why the worker exists at all
 *           rather than a routing rule.
 *
 *           NO EDGE CACHE ON PURPOSE. Caching a 37.7 MiB body through the Cache
 *           API means `response.clone()` teeing that stream against a 128 MB
 *           worker memory ceiling, and a slow client is what makes the tee grow.
 *           A failure there is a client that will not boot. The browser cache
 *           carries the repeat visit instead: `must-revalidate` plus R2's ETag
 *           turns a returning player into a 304 with no body, which is the case
 *           that actually matters.
 */

/**
 * Path prefixes this worker owns, each serving one R2 key space.
 *
 * MUST AGREE WITH `assets.run_worker_first` IN `wrangler.jsonc`. A prefix
 * listed there but not here reaches the worker and falls through to ASSETS as
 * a 404; a prefix listed here but not there is shadowed by any real asset of
 * the same name. `worker/routes.test.mjs` asserts the two lists are equal so
 * the pair cannot drift silently.
 */
export const R2_ROUTE_PREFIXES = [
    "/client/",
    "/static/webclient/models/",
] as const;

/**
 * Content types by file extension.
 *
 * This table is the owner, not the `httpMetadata` R2 stores at upload time. A
 * bulk `wrangler r2 object put` loop is easy to run without `--content-type`,
 * and a `.wasm` served as `application/octet-stream` fails
 * `WebAssembly.instantiateStreaming` -- which does not error, it silently falls
 * back to the slow path. Deciding it here means the upload cannot get it wrong.
 */
const CONTENT_TYPES: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    wasm: "application/wasm",
    pck: "application/octet-stream",
    glb: "model/gltf-binary",
    png: "image/png",
    svg: "image/svg+xml",
    md: "text/markdown; charset=utf-8",
};

const FALLBACK_CONTENT_TYPE = "application/octet-stream";

const DIRECTORY_INDEX = "index.html";

/**
 * Godot ships no content hash in its filenames -- every export writes
 * `index.wasm` again -- so an `immutable` cache would hand a returning player a
 * stale engine after a deploy, with no URL change to break it. Revalidate every
 * time and let the ETag make that free.
 */
const CACHE_CONTROL = "public, max-age=0, must-revalidate";


/**
 * Purpose: Map a request path onto its R2 object key.
 *
 * Entry:   pathname is the pathname of a parsed request URL, leading slash and
 *          all.
 *
 * Exit/Returns:
 *          The R2 key (no leading slash) when the path falls under a prefix
 *          this worker owns, else null, meaning the caller should delegate to
 *          the static assets. A path ending in `/` resolves to the directory
 *          index beneath it.
 *
 * Author: Nick Hobar
 * Creation date: 08/27/2026
 */
export function r2Key(pathname: string): string | null {
    const owned = R2_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    if (!owned) {
        return null;
    }

    const path = pathname.endsWith("/") ? pathname + DIRECTORY_INDEX : pathname;

    return path.slice(1);
}


/**
 * Purpose: Redirect a bare prefix to its directory form so the relative URLs
 *          inside the client resolve against the right base.
 *
 * Entry:   url is a parsed request URL.
 *
 * Exit/Returns:
 *          A 301 to `pathname + "/"` when the path is one of this worker's
 *          prefixes with the trailing slash missing, else null.
 *
 * Notes:   Without this, `playblackout.io/client` reaches no R2 key and falls
 *          through to the site's 404 page -- which is the URL a player is most
 *          likely to type by hand.
 *
 * Author: Nick Hobar
 * Creation date: 08/27/2026
 */
function _directoryRedirect(url: URL): Response | null {
    const isBarePrefix = R2_ROUTE_PREFIXES.some(
        (prefix) => prefix === url.pathname + "/",
    );

    if (!isBarePrefix) {
        return null;
    }

    const target = new URL(url);
    target.pathname = url.pathname + "/";

    return Response.redirect(target.toString(), 301);
}


/**
 * Purpose: Build the response headers for one stored object.
 *
 * Entry:   object is an R2 object or object body; key is the R2 key it was
 *          fetched under.
 *
 * Exit/Returns:
 *          Headers carrying the content type from CONTENT_TYPES, the cache
 *          policy, R2's ETag, and nosniff. R2's own httpMetadata is ignored --
 *          see CONTENT_TYPES.
 *
 * Author: Nick Hobar
 * Creation date: 08/27/2026
 */
function _responseHeaders(object: R2Object, key: string): Headers {
    const extension = key.split(".").pop() ?? "";
    const contentType = CONTENT_TYPES[extension] ?? FALLBACK_CONTENT_TYPE;

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", CACHE_CONTROL);
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");

    return headers;
}


/**
 * Purpose: Answer a request for one object in the asset store.
 *
 * Entry:   key is a non-empty R2 key; request.method is GET or HEAD.
 *
 * Exit/Returns:
 *          200 with the body, 304 when the caller's validators still match, or
 *          404 when the key is absent.
 *
 * Methodology:
 *          R2 is handed the request headers directly as `onlyIf`, so it decides
 *          the conditional itself. When the condition fails it returns an
 *          R2Object with no `body` property, and that absence -- not a status
 *          code -- is what distinguishes a 304 from a hit.
 *
 * Author: Nick Hobar
 * Creation date: 08/27/2026
 */
async function _serveObject(
    request: Request,
    store: R2Bucket,
    key: string,
): Promise<Response> {
    const object = await store.get(key, { onlyIf: request.headers });

    if (object === null) {
        return new Response("Not Found", { status: 404 });
    }

    const headers = _responseHeaders(object, key);

    if (!("body" in object)) {
        return new Response(null, { status: 304, headers });
    }

    headers.set("Content-Length", String(object.size));
    const body = request.method === "HEAD" ? null : object.body;

    return new Response(body, { status: 200, headers });
}


export default {
    /**
     * Purpose: Route a request either to the R2 asset store or to the static
     *          site Astro built.
     *
     * Entry:   No conditions.
     *
     * Exit/Returns:
     *          The stored object for a path under R2_ROUTE_PREFIXES, a 405 for
     *          a write method against one, and whatever the ASSETS binding says
     *          for everything else -- including its configured 404 page.
     *
     * Author: Nick Hobar
     * Creation date: 08/27/2026
     */
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        const redirect = _directoryRedirect(url);

        if (redirect !== null) {
            return redirect;
        }

        const key = r2Key(url.pathname);

        if (key === null) {
            return env.ASSETS.fetch(request);
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
            return new Response("Method Not Allowed", {
                status: 405,
                headers: { Allow: "GET, HEAD" },
            });
        }

        return _serveObject(request, env.ASSET_STORE, key);
    },
} satisfies ExportedHandler<Env>;
