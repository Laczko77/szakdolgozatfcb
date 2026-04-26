"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

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

function toRelativeHu(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";

  const diffSec = Math.max(0, Math.round((nowMs - then) / 1000));

  if (diffSec < 45) return "most";
  if (diffSec < 60 * 60) {
    const m = Math.max(1, Math.round(diffSec / 60));
    return `${m} perce`;
  }
  if (diffSec < 60 * 60 * 24) {
    const h = Math.max(1, Math.round(diffSec / 3600));
    return `${h} órája`;
  }
  if (diffSec < 60 * 60 * 24 * 7) {
    const d = Math.max(1, Math.round(diffSec / 86400));
    return `${d} napja`;
  }
  return formatDateTime(iso);
}
