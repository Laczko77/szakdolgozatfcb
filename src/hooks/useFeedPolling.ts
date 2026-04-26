"use client";

import { useEffect, useRef } from "react";


/**
 * 3-second `since`-filtered polling, gated on document visibility.
 *
 * Drops F11.4 onto any feed-style component. The polled callback is
 * given the timestamp of the last successful poll so the server only
 * has to return rows created after that moment — keeping the existing
 * list stable (no jumps) and minimising bandwidth.
 *
 * Usage:
 *   const onTick = useCallback(async (since) => {
 *     const { posts } = await fetchPosts({ since });
 *     setPosts((prev) => mergeNewPosts(prev, posts));
 *   }, []);
 *   useFeedPolling(onTick, { intervalMs: 3000, enabled: true });
 *
 * Behaviour:
 *   - Skips ticks while `document.visibilityState !== 'visible'` so a
 *     backgrounded tab doesn't burn the user's battery or rate-limit.
 *   - Resets the `since` cursor to "now" on (re-)enable so a tab that
 *     wakes up after 10 minutes doesn't dump a flood of accumulated
 *     posts on the user.
 *   - Coalesces overlapping ticks: if a previous fetch is still in
 *     flight when the timer fires, the next tick is skipped rather
 *     than queued, which prevents stampedes on slow networks.
 */
interface UseFeedPollingOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export function useFeedPolling(
  onTick: (since: string) => Promise<void>,
  { intervalMs = 3000, enabled = true }: UseFeedPollingOptions = {},
) {
  // Keep the latest callback reference without re-creating the interval
  // every render — the consumer almost always passes a fresh closure.
  // Updating the ref in an effect (rather than during render) keeps
  // `react-hooks/refs` quiet.
  const callbackRef = useRef(onTick);
  useEffect(() => {
    callbackRef.current = onTick;
  }, [onTick]);

  // The "since" cursor is mutable across ticks but doesn't need to
  // trigger renders, so a ref is the right shape.
  const sinceRef = useRef<string>(new Date().toISOString());
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      if (inFlightRef.current) return;

      // Capture the cursor BEFORE the fetch; advance it AFTER the
      // promise resolves so a slow round-trip doesn't lose data
      // created between request and response.
      const cursor = sinceRef.current;
      const nextCursor = new Date().toISOString();
      inFlightRef.current = true;
      try {
        await callbackRef.current(cursor);
        sinceRef.current = nextCursor;
      } catch {
        // Swallow — the consumer should toast/log inside its callback.
        // We deliberately don't advance the cursor on failure so the
        // next tick re-attempts the missed window.
      } finally {
        inFlightRef.current = false;
      }
    };

    // Reset the cursor whenever polling re-enables — see file header.
    sinceRef.current = new Date().toISOString();

    timer = setInterval(tick, intervalMs);

    // Wake-on-visibility: when the user comes back to the tab, snap
    // the cursor forward (no flood) and run an immediate tick so
    // stale UIs catch up faster than the next interval boundary.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        sinceRef.current = new Date().toISOString();
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
