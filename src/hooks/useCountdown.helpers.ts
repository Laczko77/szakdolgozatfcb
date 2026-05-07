/**
 * Pure helper for the {@link useCountdown} hook. Extracted so that the
 * countdown math can be unit-tested without a React renderer.
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

export function computeParts(
  targetIso: string | null | undefined,
): CountdownParts {
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
