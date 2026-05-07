/**
 * Pure helper for the {@link RelativeTime} component. Extracted so the
 * Hungarian relative-time formatter can be unit-tested without React.
 */

import { formatDateTime } from "@/lib/format";

export function toRelativeHu(iso: string, nowMs: number): string {
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
