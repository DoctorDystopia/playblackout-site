---
title: "Hello from the grid"
description: "Blackout now has a front door. Here's what's running behind it, and what's coming next."
date: 2026-08-21
tags: ["meta", "infrastructure"]
---

Blackout has been a private project for a while. This is the part where it gets
a public address.

## What's live

The site you're reading is a static build deployed to Cloudflare's edge. The
game itself runs somewhere else entirely — on a machine in my apartment, reached
through an outbound tunnel. That split is deliberate: when I reload the game
server mid-session (which is often), this page stays up.

## What Blackout is

A text MUD, cyberpunk, built on Evennia. Skills instead of classes, 127 levels
per line, and combat maths derived from Old School RuneScape's formulas and
rescaled to fit. Those formulas are scale-agnostic, which turned out to be a
useful property — it means monster stats from a well-balanced game transfer
almost directly.

## What's next

- More of the city actually walkable
- Crafting chains that reach further than the first tier
- Whatever the first handful of players complain about loudest

If you want to poke at it, the client is [right here](/play). It is early. Things
will break, and I would rather they break with someone watching.
