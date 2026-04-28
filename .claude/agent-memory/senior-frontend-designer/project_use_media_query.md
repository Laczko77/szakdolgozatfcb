---
name: useMediaQuery hook
description: Reusable client-side media-query subscription, lives at src/hooks/useMediaQuery.ts
type: project
---

`useMediaQuery(query: string): boolean` is the canonical way to react to
viewport / pointer media queries from a client component. Lives at
`src/hooks/useMediaQuery.ts`.

Why: Added in F22 (dream team) to detect touch / mobile and switch
between drag-and-drop and tap-to-select. Now available for any future
breakpoint-conditional behaviour.

How to apply: Returns `false` on the first render (server + initial
client paint) and updates to the actual value after mount via
`queueMicrotask`-wrapped setState. If you need SSR-stable markup, gate
behind a separate `mounted` flag — the hook itself does not.
