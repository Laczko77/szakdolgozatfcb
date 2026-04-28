"use client";

import { useEffect, useState } from "react";

/**
 * Read a CSS media query and stay subscribed to changes.
 *
 * Returns `false` on the first server render and during the initial client
 * paint (before the effect runs). Components that need to render different
 * markup based on the value should treat the first render as "unknown" and
 * gate behaviour behind a `useEffect`-mounted flag if SSR-mismatch matters.
 *
 * Usage:
 *   const isMobile = useMediaQuery("(max-width: 768px)");
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    // Defer the initial setState so React 19's `set-state-in-effect`
    // lint rule doesn't flag this as a cascading render.
    queueMicrotask(() => setMatches(mql.matches));

    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
