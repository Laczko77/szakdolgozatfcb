"use client";

import { cn } from "@/lib/utils";

export type MatchStatusKind = "available" | "soon" | "past";

interface MatchStatusBadgeProps {
  status: MatchStatusKind;
  className?: string;
}

/**
 * Three-state pill rendered on every match card / hero.
 *
 * The kind is derived in {@link deriveMatchStatus} from the ISO date so
 * we have one canonical mapping: anything within the next 30 days is
 * "Jegyvásárlás elérhető", later upcoming matches read as "Hamarosan",
 * and past matches collapse to a muted "Lejátszott".
 */
export function MatchStatusBadge({ status, className }: MatchStatusBadgeProps) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "rounded-full border px-2.5 py-1",
        "text-[10px] font-semibold uppercase tracking-[0.22em]",
        meta.classes,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", meta.dotClasses)}
      />
      {meta.label}
    </span>
  );
}

/**
 * Decide which badge applies for a given match date.
 *
 * Buying is "available" once the match is scheduled within the next
 * `availableWindowDays` and the date hasn't passed — otherwise the user
 * is told to come back ("soon") or that the match is already over.
 */
export function deriveMatchStatus(
  iso: string,
  now: number = Date.now(),
  availableWindowDays = 60,
): MatchStatusKind {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "past";
  if (t < now) return "past";
  const days = (t - now) / 86_400_000;
  return days <= availableWindowDays ? "available" : "soon";
}

const STATUS_META: Record<
  MatchStatusKind,
  { label: string; classes: string; dotClasses: string }
> = {
  available: {
    label: "Jegyvásárlás elérhető",
    classes:
      "border-emerald-400/40 bg-emerald-400/10 text-emerald-300 [data-theme='light']_&:text-emerald-700 [data-theme='light']_&:bg-emerald-500/10 [data-theme='light']_&:border-emerald-500/40",
    dotClasses: "bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]",
  },
  soon: {
    label: "Hamarosan",
    classes:
      "border-[var(--accent-gold)]/45 bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]",
    dotClasses: "bg-[var(--accent-gold)]",
  },
  past: {
    label: "Lejátszott",
    classes:
      "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)]",
    dotClasses: "bg-[var(--text-muted)]",
  },
};
