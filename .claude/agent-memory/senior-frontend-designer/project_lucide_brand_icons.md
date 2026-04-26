---
name: Lucide brand icons removed
description: lucide-react in this project no longer ships Twitter/Instagram/YouTube glyphs — render brand marks via inline SVG instead
type: project
---

The `lucide-react` version installed in this repo does not export brand
glyphs (`Twitter`, `Instagram`, `Youtube`, `Facebook`, etc.) — these were
stripped upstream from Lucide for trademark reasons.

**Why:** `npx tsc --noEmit` will fail with TS2305 "Module 'lucide-react'
has no exported member 'Twitter'" if you try to import them.

**How to apply:** When a backlog task asks for social/brand icons, render
them as inline `<svg>` glyphs (see `src/components/layout/Footer.tsx` for
the X/IG/YT path data) rather than importing from lucide-react. Generic
icons (Search, ChevronDown, ArrowRight, Trophy, Newspaper, Medal) are
fine to import as usual.
