# playblackout-site

Marketing site, devlog, and worldbuilding pages for **Blackout**, a cyberpunk MUD.
Astro + Tailwind, built to static HTML and served from a Cloudflare Worker.

The **game server** is a separate thing entirely — it lives in
[`muddev`](https://github.com/DoctorDystopia/muddev) and runs on hardware at home,
reached through a Cloudflare Tunnel at `game.playblackout.io`. This repo never
talks to it; it only links to it.

## Hostnames

| Hostname | Serves | How |
|---|---|---|
| `playblackout.io` | this site | Worker, static assets |
| `www.playblackout.io` | → apex | Redirect Rule |
| `game.playblackout.io` | Evennia webclient | Cloudflare Tunnel → home PC :4001 |
| `playblackout.net` (+ www) | → `.io` | Redirect Rule |

## Local development

```bash
npm install
npm run dev        # http://localhost:4321, hot reload
npm run build      # static build into ./dist
npm run preview    # serve ./dist exactly as the Worker will
```

## Writing a post

Add a markdown file to `src/content/blog/`. Frontmatter is schema-checked in
`src/content.config.ts`, so a typo fails the build instead of shipping broken:

```markdown
---
title: "Post title"
description: "One sentence. Used for the card and the OG tag."
date: 2026-08-21
tags: ["combat", "engine"]
draft: false
---
```

`draft: true` keeps a post out of the build, the index, and the RSS feed.
Worldbuilding pages work the same way in `src/content/lore/`, ordered by an
`order:` number instead of a date.

Push to `main` and Cloudflare rebuilds. Push any other branch for a preview URL.

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

`wrangler.jsonc` points `assets.directory` at `./dist`. There is no `main`
worker script — the site is purely static. Add one plus an `ASSETS` binding if
it ever needs server-side rendering.

## Placeholder content

These need replacing before launch:

- `DISCORD_URL` in `src/config.ts` is a dead invite link
- `src/content/lore/*.md` are stubs
- `src/content/blog/2026-08-14-combat-on-a-tick.md` is a draft stub
- `/og-default.png` referenced by `Base.astro` does not exist yet
