"use client";

import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchListEmptyStateProps {
  scope: "upcoming" | "past";
  className?: string;
}

/**
 * Friendly empty state for the match list. The copy switches by scope so
 * "no upcoming matches" reads differently from "no past matches in
 * history yet" — both are legitimate states early in the season.
 */
export function MatchListEmptyState({
  scope,
  className,
}: MatchListEmptyStateProps) {
  const copy =
    scope === "upcoming"
      ? {
          title: "Nincs ütemezett mérkőzés",
          body: "Pillanatnyilag nincs jegyvásárlásra elérhető meccs. Amint új találkozó kerül a naptárba, automatikusan itt jelenik meg.",
        }
      : {
          title: "Nincs lejátszott meccs",
          body: "A korábbi meccsek archívuma egyelőre üres. A szezon folyamán itt visszanézheted a végeredményeket.",
        };

  return (
    <div
      className={cn(
        "glass-card relative flex flex-col items-center justify-center gap-4",
        "p-10 text-center sm:p-14",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "text-[var(--accent-gold)]",
        )}
      >
        <CalendarDays size={22} />
      </div>
      <h3 className="font-display text-2xl tracking-wide text-[var(--text-primary)]">
        {copy.title}
      </h3>
      <p className="max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
        {copy.body}
      </p>
    </div>
  );
}
