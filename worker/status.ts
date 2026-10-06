/**
 * Purpose:  Answer the status light in the nav bar from the game server.
 *
 * Notes:    THE ANSWER IS CACHED. Its body is some 30 bytes, so the memory
 *           argument against the edge cache in `index.ts` does not apply. The
 *           cache is what keeps page views off the home PC: at most one probe
 *           for each Cloudflare location in each STATUS_CACHE_SECONDS.
 *
 *           A MODULE OF ITS OWN, not a part of `index.ts`. The Workers runtime
 *           reads every named export of the main module as a handler, and it
 *           refuses to start when one is a number.
 *
 *           The game half is `muddev/blackout/systems/interface/serverstatus/`.
 */

import { GAME_STATUS_URL, STATUS_API_PATH } from "../src/config.ts";

/**
 * How long one probe of the game server stands, at the edge and in the
 * browser. The light polls every 60 seconds (see ServerStatus.astro), so a
 * player sees a change within about 90 seconds.
 */
export const STATUS_CACHE_SECONDS = 30;

/**
 * How long the probe waits. A tunnel with no origin answers 530 at once, so
 * this bounds only a server that accepts the request and then hangs.
 */
const STATUS_TIMEOUT_MS = 4000;

/** What the status light reads. `players` is null when the server is down. */
export interface ServerStatus {
    online: boolean;
    players: number | null;
}

const OFFLINE: ServerStatus = { online: false, players: null };


/**
 * Purpose: Read the JSON body of the game server's status endpoint.
 *
 * Entry:   body is whatever `response.json()` gave, of any shape.
 *
 * Exit/Returns:
 *          `{online: true, players}` when the body says `online: true` and
 *          `players` is a whole number of zero or more, else OFFLINE.
 *
 * Notes:   ANYTHING ELSE IS DOWN. A server that is down cannot say so, so
 *          the worker owns that rule, not the game. A tunnel with no origin
 *          answers a Cloudflare error page, and a stopped Evennia Server
 *          behind a live Portal answers a proxy error. Neither is this JSON.
 *
 * Author: Nick Hobar
 * Creation date: 10/06/2026
 */
export function parseStatus(body: unknown): ServerStatus {
    if (typeof body !== "object" || body === null) {
        return OFFLINE;
    }

    const record = body as Record<string, unknown>;
    const players = record.players;
    const isCount = typeof players === "number" && Number.isInteger(players) && players >= 0;

    if (record.online !== true || !isCount) {
        return OFFLINE;
    }

    return { online: true, players: players as number };
}


/**
 * Purpose: Ask the game server for its status, one time.
 *
 * Entry:   No conditions.
 *
 * Exit/Returns:
 *          The parsed status. A timeout, a network error, a non-2xx status,
 *          or a body that is not JSON all give OFFLINE. Never throws.
 *
 * Author: Nick Hobar
 * Creation date: 10/06/2026
 */
async function _probeGame(): Promise<ServerStatus> {
    try {
        const response = await fetch(GAME_STATUS_URL, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
        });

        if (!response.ok) {
            return OFFLINE;
        }

        const body: unknown = await response.json();

        return parseStatus(body);
    } catch {
        return OFFLINE;
    }
}


/**
 * Purpose: Answer the status light.
 *
 * Entry:   request is a request for STATUS_API_PATH; ctx is the execution
 *          context of the fetch handler.
 *
 * Exit/Returns:
 *          200 with a ServerStatus as JSON, or 405 for a write method.
 *
 * Methodology:
 *          The edge cache is keyed on a GET for this origin and path, with no
 *          query string, so a `?nocache=1` cannot force a probe of the home
 *          PC. The put runs after the response, in `waitUntil`.
 *
 * Author: Nick Hobar
 * Creation date: 10/06/2026
 */
export async function serveStatus(request: Request, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", {
            status: 405,
            headers: { Allow: "GET, HEAD" },
        });
    }

    const cacheKey = new Request(new URL(STATUS_API_PATH, request.url).toString());
    const cached = await caches.default.match(cacheKey);

    if (cached !== undefined) {
        return cached;
    }

    const status = await _probeGame();
    const response = Response.json(status, {
        headers: {
            "Cache-Control": `public, max-age=${STATUS_CACHE_SECONDS}`,
            "X-Content-Type-Options": "nosniff",
        },
    });

    ctx.waitUntil(caches.default.put(cacheKey, response.clone()));

    return response;
}
