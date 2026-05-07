"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { toRelativeHu } from "./RelativeTime.helpers";

/**
 * Renders an ISO timestamp as a Hungarian relative phrase
 * ("most", "5 perce", "2 órája", "3 napja"…) and falls back
 * to {@link formatDateTime} once the gap exceeds a week.
 *
 * The component re-computes its label every minute so a long-lived
 * feed doesn't go stale ("most" still showing two hours later).
 *
 * SSR-safe: the first render returns the absolute date so server
 * and client markup match; we swap to the relative phrase on the
 * first effect tick, avoiding a hydration mismatch.
 */
interface RelativeTimeProps {
  iso: string;
  className?: string;
}

export function RelativeTime({ iso, className }: RelativeTimeProps) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Defer to a microtask so the synchronous setState inside the
    // effect body doesn't trip `react-hooks/set-state-in-effect`.
    queueMicrotask(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const label = now === null ? formatDateTime(iso) : toRelativeHu(iso, now);

  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {label}
    </time>
  );
}

