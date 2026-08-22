/**
 * Purpose:  One owner for "which entries are visible, and in what order".
 * Entry:    Called from any page that lists or renders posts / lore.
 * Exit:     Sorted arrays of collection entries.
 * Notes:    Drafts are visible in `npm run dev` and hidden in `npm run build`.
 *           That is deliberate -- it lets you preview an unfinished post
 *           locally without editing its frontmatter and risking a commit that
 *           publishes it by accident.
 */
import { getCollection, type CollectionEntry } from "astro:content";

/** True during `astro dev`, false during `astro build`. */
const SHOW_DRAFTS = import.meta.env.DEV;

function _isVisible(entry: { data: { draft: boolean } }): boolean {
  return SHOW_DRAFTS || !entry.data.draft;
}

/** Devlog posts, newest first. */
export async function getPosts(): Promise<CollectionEntry<"blog">[]> {
  const posts = await getCollection("blog", _isVisible);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Lore entries, ordered by their `order:` frontmatter field. */
export async function getLore(): Promise<CollectionEntry<"lore">[]> {
  const entries = await getCollection("lore", _isVisible);
  return entries.sort((a, b) => a.data.order - b.data.order);
}
