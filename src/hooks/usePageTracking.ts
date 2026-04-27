"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/providers/ConsentProvider";
import { postPageView } from "@/lib/analytics-api";

/**
 * Page-view tracking hook — F14.2.
 *
 * Mounted exactly once via {@link PageTrackingMount} and listens to the
 * App Router's pathname. On every route change AND on initial load (post-
 * consent), it fires a single fire-and-forget POST to
 * `/api/tracking/pageview`.
 *
 * Gates:
 *   - Only fires when the user has explicitly accepted cookies.
 *   - Only fires when a `cookieId` is present (the server gate would
 *     drop the request anyway, but we save the round-trip).
 *   - Skips duplicate consecutive sends for the same path — useful when
 *     React Strict Mode double-invokes effects in development.
 *
 * Product detail support:
 *   When the path matches `/shop/<uuid>`, the hook extracts the UUID
 *   and forwards it as `product_id` so the backend can populate the
 *   product analytics view used by F14.3 / admin dashboards.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_PATH_RE = /^\/shop\/([^/?#]+)/i;

function extractProductId(pathname: string): string | null {
  const match = pathname.match(PRODUCT_PATH_RE);
  if (!match) return null;
  const candidate = match[1];
  if (!UUID_RE.test(candidate)) return null;
  return candidate.toLowerCase();
}

export function usePageTracking(): void {
  const pathname = usePathname();
  const { record } = useConsent();
  // Last path we successfully (or attempted to) ping for. Prevents
  // double-fires from Strict Mode double-invocation and from any
  // React re-renders that don't actually change the path.
  const lastSentPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (record?.status !== "accepted") {
      // Reset so a future "accept" re-fires for the current page.
      lastSentPathRef.current = null;
      return;
    }
    if (!record.cookieId) return;
    if (lastSentPathRef.current === pathname) return;

    lastSentPathRef.current = pathname;

    void postPageView({
      cookieId: record.cookieId,
      pagePath: pathname,
      productId: extractProductId(pathname),
    });
  }, [pathname, record?.status, record?.cookieId]);
}
