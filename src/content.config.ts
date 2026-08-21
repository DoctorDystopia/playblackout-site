/**
 * Purpose:  Declare the typed content collections the site renders.
 * Entry:    Astro loads this automatically at build time.
 * Exit:     Two collections - `blog` (dev journal) and `lore` (worldbuilding).
 * Notes:    Frontmatter is schema-checked, so a malformed post fails the build
 *           instead of shipping a broken page.
 */
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const lore = defineCollection({
  loader: glob({ base: "./src/content/lore", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(99),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, lore };
