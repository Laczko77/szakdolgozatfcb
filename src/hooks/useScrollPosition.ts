"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight scroll-position tracker.
 *
 * Uses requestAnimationFrame coalescing so the consumer re-renders at most
 * once per frame regardless of how aggressively the user scrolls. Returns
 * the current `window.scrollY`. Returns 0 during SSR.
 *
 * Used by the desktop Navbar to "materialize" its glass background once
 * the user scrolls away from the top of the page.
 */
export function useScrollPosition(): number {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    let mounted = true;

    const update = () => {
      frame = 0;
      if (!mounted) return;
      setScrollY(window.scrollY);
    };

    const onScroll = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(update);
    };

    // Capture initial position (e.g. when navigating back to a scrolled page).
    setScrollY(window.scrollY);

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      mounted = false;
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return scrollY;
}
