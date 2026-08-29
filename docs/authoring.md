# Working on playblackout.io

Everything you can change on the public site, and the exact file to change it in.

The site is a **static build**. Astro turns `src/` into plain HTML at build time
and Cloudflare serves those files from its edge. Nothing runs on a server when a
visitor loads a page, which is why the site stays up when the game server
restarts. It is also the main limit — see [What static can't do](#what-static-cant-do).

---

## Quick reference

| I want to change... | File |
|---|---|
| A blog post's text | `src/content/blog/<post>.md` |
| A lore page's text | `src/content/lore/<entry>.md` |
| Site name, tagline, meta description | `src/config.ts` |
| Link to the game client, Discord, GitHub | `src/config.ts` |
| Nav bar links | `src/config.ts` → `NAV_LINKS` |
| Hero headline, buttons, the four pillar cards | `src/pages/index.astro` |
| Anything on `/play` | `src/pages/play.astro` |
| "Devlog" heading and intro | `src/pages/blog/index.astro` |
| "The world" heading and intro | `src/pages/lore/index.astro` |
| 404 page | `src/pages/404.astro` |
| Footer | `src/components/Footer.astro` |
| Colours, fonts, spacing | `@theme` block in `src/styles/global.css` |
| The brand mark, and the sizes it ships in | `src/config.ts` → `BRAND_MARK`; see [brand-mark.md](brand-mark.md) |
| Which posts are visible, and their order | `src/lib/content.ts` |
| Allowed frontmatter fields | `src/content.config.ts` |

Rule of thumb: **prose lives in `src/content/`, interface text lives in the
`.astro` file for that page, anything shared across pages lives in `config.ts`.**

Can't find a string? Grep for it:

```bash
grep -rn "Read the devlog" src/
```

---

## Publish a devlog post

Create a file in `src/content/blog/`. The filename becomes the URL:

```
src/content/blog/2026-09-02-crafting-tiers.md   →   /blog/2026-09-02-crafting-tiers
```

```markdown
---
title: "Crafting tiers finally connect"
description: "The foundry now feeds metalsmithing, and both feed the anvil."
date: 2026-09-02
tags: ["crafting", "systems"]
draft: false
---

Body text in normal markdown. Headings, lists, links, `code`, and fenced
code blocks are all styled already.
```

### Frontmatter fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | Page heading, card heading, browser tab |
| `description` | string | yes | Card subtitle, meta description, RSS summary |
| `date` | `YYYY-MM-DD` | yes | Sorts the list; displayed on the post |
| `tags` | list | no | Defaults to `[]`. Display only — no tag pages yet |
| `draft` | boolean | no | Defaults to `false` |

Get a field wrong and **the build fails, naming the file and the problem**. That
is deliberate: a typo stops the deploy instead of shipping a broken page.

### Drafts

`draft: true` means the post is **visible in `npm run dev`** and **excluded from
the build** — no page, no listing entry, no RSS item, no sitemap entry.

So the workflow is: write with `draft: true`, preview locally as long as you
like, flip to `false` when ready. You never edit frontmatter just to see your own
post, which means you can't accidentally commit a preview flag.

### Publishing

```bash
git add src/content/blog/2026-09-02-crafting-tiers.md
```

```bash
git commit -m "devlog: crafting tiers" && git push
```

Cloudflare rebuilds automatically. The post appears on `/blog`, on the homepage
if it is one of the three newest, and in `/blog/rss.xml`.

> **Do not rename a file after publishing.** The filename *is* the permalink.
> Renaming breaks every existing link and re-delivers the post to RSS readers as
> new. Change the `title` freely; leave the filename alone.

---

## Add a lore entry

Same idea in `src/content/lore/`, ordered by a number instead of a date:

```markdown
---
title: "The Undercroft"
description: "Below the flood line, where the power still works."
order: 3
draft: false
---
```

`order` sorts `/lore` — low numbers first, default `99`. Leave gaps (10, 20, 30)
so you can insert entries later without renumbering everything.

---

## Add images

Put files in `public/`. Anything there is served from the site root, unprocessed:

```
public/images/skyline.png   →   /images/skyline.png
```

In markdown:

```markdown
![The Neo-Cairo skyline at night](/images/skyline.png)
```

In an `.astro` page:

```html
<img src="/images/skyline.png" alt="The Neo-Cairo skyline at night" />
```

Always write real alt text — it is what screen readers announce and what shows
when an image fails to load.

**Compress before committing.** These files ship as-is, and git keeps every
version of a binary forever. A 4 MB screenshot is 4 MB in the repo permanently.

### The social preview image

`src/layouts/Base.astro` points every page's OpenGraph tag at `/og-default.png`,
which **does not exist yet**. Until you add it, links shared to Discord show no
image. Make it 1200×630.

---

## Add a new page

One file in `src/pages/` becomes one route. `src/pages/roadmap.astro` → `/roadmap`.

```astro
---
import Base from "../layouts/Base.astro";
---

<Base title="Roadmap" description="What's being built next.">
  <section class="mx-auto max-w-2xl px-6 py-20">
    <h1 class="text-4xl font-bold tracking-tight text-ink sm:text-5xl">Roadmap</h1>
    <p class="mt-4 text-lg text-ink-dim">What's being built, roughly in order.</p>
  </section>
</Base>
```

`title` and `description` feed the tab title, the meta description, and the
social preview. The `class` strings are Tailwind utilities — copy layout classes
from an existing page rather than inventing new ones, so pages stay consistent.

## Add it to the nav

`src/config.ts`:

```ts
export const NAV_LINKS = [
  { href: "/blog", label: "Devlog" },
  { href: "/lore", label: "World" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/play", label: "Play" },
] as const;
```

Active-state highlighting is automatic.

---

## Add a whole new section

Say you want `/news` separate from `/blog`. Four steps:

**1.** Create `src/content/news/` and put a markdown file in it.

**2.** Declare the collection in `src/content.config.ts`:

```ts
const news = defineCollection({
  loader: glob({ base: "./src/content/news", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, lore, news };   // add it here too
```

**3.** Add a query helper in `src/lib/content.ts`, so draft handling stays in one
place:

```ts
export async function getNews(): Promise<CollectionEntry<"news">[]> {
  const items = await getCollection("news", _isVisible);
  return items.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
```

**4.** Copy `src/pages/blog/index.astro` and `src/pages/blog/[...slug].astro`
into `src/pages/news/`, and swap `getPosts` for `getNews`.

Then add the nav link. The `[...slug].astro` file is what generates one page per
markdown file — without it the entries exist but have no URLs.

---

## Change the look

All colours, fonts and spacing tokens live in the `@theme` block at the top of
`src/styles/global.css`. Change a value there and it updates everywhere:

```css
@theme {
  --color-void: #07080b;        /* page background */
  --color-surface: #0e1016;     /* cards, panels */
  --color-edge: #232838;        /* borders, dividers */
  --color-ink: #e4e7ee;         /* primary text */
  --color-ink-dim: #98a0b3;     /* secondary text */
  --color-signal: #37e0d8;      /* links, buttons, accents */
  --color-flare: #ff4d8d;       /* warnings, the 404 */
}
```

Used in markup as `bg-void`, `text-ink-dim`, `border-edge`, and so on.

Never hardcode a hex value in a component — that is how a colour ends up with
two owners and the site drifts out of sync with itself.

**Changing a font takes two edits**: the `--font-*` token in `global.css`, *and*
the Google Fonts link in `src/layouts/Base.astro`. Miss the second and the
browser silently falls back to a system font.

Article body styling — paragraph spacing, blockquotes, code blocks — is the
`.prose-blackout` block lower in the same file.

---

## What happens when you push

```
git push origin main
        |
        v
Cloudflare clones the repo
        |
        v
npm clean-install
        |
        v
npm run build          <- set in the dashboard, not in the repo
        |
        v
npx wrangler deploy    <- uploads ./dist + worker/index.ts
        |
        v
live on playblackout.io
```

This publishes the **site**. It does not publish the game client — that lives in
an R2 bucket and is uploaded from `muddev` by `deploy/webexport/publish.ps1`.
Writing a post never touches it.

Push to **any other branch** for a preview URL — the build runs but production is
untouched. Good for a redesign you want to look at before committing to it.

Watch it at **Workers & Pages → playblackout-site → Deployments**.

### If a build fails

The site stays on the last good deploy. Nothing goes down. Read the log — the
failure is almost always one of:

- a frontmatter typo (the log names the file)
- a missing import after moving a file
- **Build command reset to `None`** — it must stay `npm run build`, or wrangler
  finds no `dist/` and fails with "directory does not exist"

### Rolling back

Dashboard → **Deployments** → pick an earlier build → **Rollback**. Instant, and
it does not touch git. Then fix the problem properly and push.

---

## What static can't do

There is no server. Every page is generated at build time, so the site cannot:

- show live player counts or server status
- accept form submissions
- run anything per-visitor

Adding any of that means installing the `@astrojs/cloudflare` adapter and
switching parts of the site to server-rendered.

**Specifically for a "players online" widget:** it would need Evennia's REST API,
which is currently off — `REST_API_ENABLED = False` in
`muddev/blackout/server/conf/settings.py`. It would also need to fail gracefully
whenever the game server is down, which is exactly the situation it exists to
report. Worth building eventually; it is real work, not a snippet.

---

## Local commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

`dev` runs on http://localhost:4321 with hot reload and drafts visible. `build`
produces `./dist` with drafts excluded. `preview` serves `./dist` exactly as
Cloudflare will.

Always `npm run build` before pushing anything structural. It catches schema
errors and broken imports in about two seconds, versus a three-minute round trip
through a failed cloud build.

If dev starts on `:4322` instead of `:4321`, an old server is still running:

```bash
npx astro dev stop
```

---

## Gotchas

- **`dist/` is gitignored on purpose.** Cloudflare builds it. Committing build
  output causes merge conflicts on every push and gains nothing.
- **Never put the Godot export under `public/`.** Astro copies `public/`
  verbatim into `dist/`, and Cloudflare rejects any static asset over 25 MiB —
  `index.wasm` is 37.7 MiB, so the whole deploy fails, not just that file. The
  client is served from R2 by `worker/index.ts`; see the repo README.
- **`SITE.description` appears in two places** — the paragraph under the hero
  *and* every page's meta description. Search results truncate around 155
  characters, so if you want long hero copy, split it into a separate field.
- **Renaming a published post breaks its URL.** See above.
- **`npm run dev` shows drafts; the live site never does.** If a post is missing
  from production, check `draft:`.
- **The build is the linter.** There is no separate lint step — if it builds, the
  content schema is valid.
