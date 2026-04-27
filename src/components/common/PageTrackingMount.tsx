"use client";

import { usePageTracking } from "@/hooks/usePageTracking";

/**
 * Tiny client component whose only job is to call {@link usePageTracking}.
 *
 * Hooks can only run inside React components, so we can't call the hook
 * directly from `layout.tsx`. Mounting this empty component once (in
 * the layout's provider tree) wires the listener for the entire app.
 */
export function PageTrackingMount(): null {
  usePageTracking();
  return null;
}
