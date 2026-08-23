/**
 * Purpose:  Single source of truth for site-wide constants.
 * Notes:    Hostnames live here and nowhere else. If the game client ever
 *           moves off game.playblackout.io, this is the only edit.
 */
export const SITE = {
  name: "Blackout",
  tagline: "A cyberpunk MUD",
  description:
    "Blackout is a text-based (with experimental 3D webclient) cyberpunk Multi-User Dungeon (MUD). Play from your browser. No download, no client (yet), no install.",
  url: "https://playblackout.io",
} as const;

/** Where the Evennia webclient is reachable. Tunnelled to the game server. */
export const GAME_URL = "https://game.playblackout.io/webclient/";

/** Replace with a real invite once the server exists. */
export const DISCORD_URL = "https://discord.gg/REPLACE-ME";

export const GITHUB_URL = "https://github.com/DoctorDystopia/muddev";

export const NAV_LINKS = [
  { href: "/blog", label: "Devlog" },
  { href: "/lore", label: "World" },
  { href: "/play", label: "Play" },
] as const;
