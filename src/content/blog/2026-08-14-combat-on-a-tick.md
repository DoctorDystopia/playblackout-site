---
title: "Combat runs on a 0.6 second tick"
description: "Why the combat loop needed a Twisted LoopingCall instead of Evennia's script scheduler."
date: 2026-08-14
tags: ["combat", "engine"]
draft: true
---

> Placeholder.

Blackout's combat resolves on a fixed 0.6 second tick. Getting that interval was
harder than it sounds.

Evennia's obvious tool is a Script with an interval, but `ScriptDB.db_interval`
is a Django `IntegerField` — 0.6 truncates straight to 0. The other obvious tool,
`TickerHandler`, rejects sub-second intervals outright.

The answer was a Twisted `LoopingCall` owned by a single tick engine, with every
combat entity registering against one clock rather than each carrying its own
timer.

[TBD]
