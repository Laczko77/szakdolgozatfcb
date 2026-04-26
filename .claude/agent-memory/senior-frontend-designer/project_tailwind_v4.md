---
name: Project uses Tailwind CSS v4 (CSS-first config)
description: This project has no tailwind.config.ts — Tailwind v4 registers tokens via @theme inline in globals.css
type: project
---

The FC Barcelona portal runs on **Tailwind CSS v4** (`tailwindcss: ^4`, `@tailwindcss/postcss`). There is no `tailwind.config.ts` / `tailwind.config.js`. Configuration is done in CSS via the `@theme inline { ... }` block in `src/app/globals.css`.

**Why:** v4 dropped JS configs in favor of CSS-first theming. Backlog tasks that say "module Tailwind config" must be translated to `@theme inline` declarations.

**How to apply:**
- To register a new utility (e.g. `bg-foo`), add `--color-foo: var(--something);` inside `@theme inline { }`.
- `darkMode: 'class'` is NOT needed — we drive light/dark with `[data-theme="..."]` selectors in `themes.css`, which switch the underlying CSS custom properties. Tailwind utilities resolve to whichever values the active theme is currently exposing.
- Token naming convention adopted in iteration F1: `--color-bg-primary`, `--color-text-primary`, `--color-glass`, `--color-accent-blue`, `--shadow-glass-md`, `--shadow-glow-gold`, etc.
- The shadcn CLI writes `tailwind.config: ""` in `components.json` because there is no JS config file, and CSS variables are enabled via `cssVariables: true`.
