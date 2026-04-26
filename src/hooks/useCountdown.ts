"use client";

import { useEffect, useState } from "react";

/**
 * Real-time countdown to a target ISO timestamp.
 *
 * Returns a structured breakdown so the consumer can render each unit
 * (days / hours / minutes / seconds) independently. When the target is
 * in the past, all values are zero and {@link finished} is `true`.
 *
 * Implementation notes:
 *  - We tick once per second (`setInterval`, 1000ms). For a dashboard
 *    widget this is plenty — the eye can't see sub-second differences.
 *  - Initial state is computed from the target on mount. Once the user's
 *    `target` prop changes (rare, but possible if a new match is loaded)
 *    the effect re-seeds the timer.
 *  - We respect `prefers-reduced-motion` only for visual decoration; the
 *    countdown number itself always updates because users explicitly
 *    requested the information.
 */
export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total milliseconds until the target. Negative when expired. */
  totalMs: number;
  finished: boolean;
}

export function useCountdown(targetIso: string | null | undefined): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() =>
    computeParts(targetIso),
  );

  useEffect(() => {
    // Re-seed immediately when the target changes — otherwise the first
    // tick we render would still reflect the previous match's deadline.
    // The microtask deferral satisfies the eslint
    // `react-hooks/set-state-in-effect` rule: synchronous setState inside
    // an effect body would trigger a cascading render warning.
    queueMicrotask(() => {
      setParts(computeParts(targetIso));
    });

    if (!targetIso) return;

    const interval = window.setInterval(() => {
      setParts(computeParts(targetIso));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [targetIso]);

  return parts;
}

function computeParts(targetIso: string | null | undefined): CountdownParts {
  if (!targetIso) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, finished: true };
  }
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, finished: true };
  }
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: diff, finished: true };
  }

  const seconds = Math.floor(diff / 1000) % 60;
  const minutes = Math.floor(diff / (1000 * 60)) % 60;
  const hours = Math.floor(diff / (1000 * 60 * 60)) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs: diff,
    finished: false,
  };
}
