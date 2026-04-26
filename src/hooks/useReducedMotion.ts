"use client";

import { useEffect, useState } from "react";

/**
 * Reactively reads the user's `prefers-reduced-motion` setting.
 *
 * Use this in components that drive expensive or large-motion animations
 * to provide a quiet fallback (e.g. omit transforms, snap into final state).
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}
