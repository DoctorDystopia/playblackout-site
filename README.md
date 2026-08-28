# playblackout-site

Marketing site, devlog, and worldbuilding pages for **Blackout**, a cyberpunk MUD.
Astro + Tailwind, built to static HTML and served from a Cloudflare Worker.

The worker also serves the **Godot game client** at `/client/`, out of R2 rather
than out of `dist/` — see [The client is not in this repo](#the-client-is-not-in-this-repo).

The **game server** is a separate thing entirely — it lives in
[`muddev`](https://github.com/DoctorDystopia/muddev) and runs on hardware at home,
reached through a Cloudflare Tunnel at `game.playblackout.io`. This repo never
talks to it; it only links to it.

## Hostnames

| Hostname | Serves | How |
|---|---|---|
| `playblackout.io` | this site | Worker, static assets |
| `playblackout.io/client/` | the Godot game client | Worker → R2 `playblackout-assets` |
| `playblackout.io/static/webclient/models/` | the client's `.glb` art | Worker → R2 `playblackout-assets` |
| `www.playblackout.io` | → apex | Redirect Rule |
| `game.playblackout.io` | Evennia websocket + legacy webclient | Cloudflare Tunnel → home PC |
| `playblackout.net` (+ www) | → `.io` | Redirect Rule |

The two R2 paths are on **this** hostname on purpose. The client fetches its
`.glb` models over ordinary HTTP, which — unlike the `wss://` game socket — is
subject to CORS, so it has to be same-origin with the page. An R2 custom domain
binds a whole hostname and would break that; a worker binding can serve a bucket
at a path.

## Local development

```bash
npm install
npm run dev        # http://localhost:4321, hot reload
npm run build      # static build into ./dist
npm run preview    # serve ./dist exactly as the Worker will
```

## Writing a post

See **[docs/authoring.md](docs/authoring.md)** — the full guide to publishing
posts, adding pages and sections, changing the design, and what the deploy does.

Short version: add a markdown file to `src/content/blog/`, `git push`, done.

## Layout

```
src/
├── config.ts           site name, game URL, nav — one owner per fact
├── content.config.ts   typed frontmatter schemas
├── content/
│   ├── blog/           devlog posts
│   └── lore/           worldbuilding
├── components/         Nav, Footer
├── layouts/            Base (head/SEO), Post (article chrome)
├── pages/              routes
└── styles/global.css   design tokens live in @theme
```

## Deployment settings

The Cloudflare Worker build must be configured as:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Root directory:** `/`

`wrangler.jsonc` points `assets.directory` at `./dist` and `main` at
`worker/index.ts`. The worker is **not** SSR — every page is still prerendered.
It exists only to serve the two R2-backed paths in the hostname table; requests
that match a static asset never reach it, and requests it does not claim are
handed straight back to the `ASSETS` binding.

The `playblackout-assets` bucket must exist before a deploy, or the binding
fails to resolve and the deploy is rejected.

## The client is not in this repo

`index.wasm` is **37.7 MiB**. Cloudflare caps an individual static asset at
**25 MiB**, on the Free plan and the Paid plan alike — there is no tier that
lifts it. So the Godot export and its model tree live in the
`playblackout-assets` R2 bucket, and `worker/index.ts` serves them.

Publishing them is a step in **`muddev`**, not here:

```powershell
deploy/webexport/publish.ps1
```

then deploy this site. Publish first — the bucket is the origin and this repo is
only the router, so a deploy without a publish points `/play` at a 404.

`public/client/` and `public/static/` are gitignored. Putting an export there
does nothing useful: Astro would copy it into `dist/` and `wrangler deploy`
would reject the upload with "Asset too large".

## Tests

```bash
npm test
```

Node's runner, no dependencies. It covers the one fact stated in two files —
which path prefixes R2 owns, named in both `worker/index.ts` and
`wrangler.jsonc`'s `run_worker_first` — plus the key mapping. Drift there is
silent otherwise.

## Placeholder content

These need replacing before launch:

- `DISCORD_URL` in `src/config.ts` is a dead invite link
- `src/content/lore/*.md` are stubs
- `src/content/blog/2026-08-14-combat-on-a-tick.md` is a draft stub
- `/og-default.png` referenced by `Base.astro` does not exist yet
