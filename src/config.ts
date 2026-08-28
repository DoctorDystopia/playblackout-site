/**
 * Purpose:  Single source of truth for site-wide constants.
 * Notes:    Hostnames live here and nowhere else. If the game server or the
 *           client moves, this is the only edit. They are two different
 *           origins now and deliberately so -- see GAME_URL.
 */
export const SITE = {
  name: "Blackout",
  tagline: "A cyberpunk MUD",
  description:
    "Blackout is a cyberpunk Multi-User Dungeon (MUD): a text game with a 3D world beside it. Play from your browser. No download, no install.",
  url: "https://playblackout.io",
} as const;

/**
 * Where the Godot client is served.
 *
 * THIS ORIGIN, not the game server's. The client is a static build and belongs
 * on the CDN beside this site: Django is a poor static host, port 4001 is behind
 * the tunnel so every byte would cross `cloudflared`, and an `evennia reload`
 * would be able to interrupt a player's DOWNLOAD rather than just their session.
 *
 * Same-origin is also load-bearing rather than incidental. The client fetches
 * its `.glb` models over ordinary HTTP, and unlike `wss://` that IS subject to
 * CORS -- `game.playblackout.io` serves no `Access-Control-Allow-Origin`. Being
 * served from here means the client asks for its art relatively and never
 * crosses an origin at all.
 *
 * The path is served by `worker/index.ts` out of the `playblackout-assets` R2
 * bucket, NOT by the static assets in `dist/` -- `index.wasm` is 37.7 MiB and
 * Cloudflare caps an individual static asset at 25 MiB on every plan it sells.
 * The worker is what keeps the bucket on this origin, since an R2 custom domain
 * binds a whole hostname and a hostname is what "same-origin" would lose.
 *
 * REQUIRES THE EXPORT TO BE IN THAT BUCKET FIRST. See
 * `muddev/deploy/webexport/README.md`. Publishing this site before that lands
 * points /play at a 404.
 */
export const GAME_URL = "https://playblackout.io/client/";

/**
 * The retired three.js webclient, still served and still working.
 *
 * Kept reachable on purpose: the Godot client is one canvas, so a browser
 * without working WebGL2 gets nothing at all, while this one degrades to its
 * text pane. See `muddev/blackout/web/static/webclient/js/README.md`.
 */
export const LEGACY_CLIENT_URL = "https://game.playblackout.io/webclient/";

/** Replace with a real invite once the server exists. */
export const DISCORD_URL = "https://discord.gg/REPLACE-ME";

export const GITHUB_URL = "https://github.com/DoctorDystopia/muddev";

export const NAV_LINKS = [
  { href: "/blog", label: "Devlog" },
  { href: "/lore", label: "World" },
  { href: "/play", label: "Play" },
] as const;
