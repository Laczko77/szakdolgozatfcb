"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { Match } from "@/types/database";
import { cn } from "@/lib/utils";

interface PollMatchBadgeProps {
  matchId: string;
  className?: string;
}

interface MatchResponse {
  match: Match;
}

/**
 * Tiny inline badge that surfaces the matchup a poll is attached to.
 *
 * Lookup is lazy (one fetch per matchId on mount) and falls back to
 * a generic "Mérkőzés" label if the match cannot be resolved — we
 * never block the poll card on missing match metadata.
 */
export function PollMatchBadge({ matchId, className }: PollMatchBadgeProps) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/matches/${matchId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as MatchResponse;
        if (!json?.match) return;
        setLabel(`${json.match.home_team} vs. ${json.match.away_team}`);
      } catch {
        /* graceful fall-through to generic label */
      }
    })();
    return () => controller.abort();
  }, [matchId]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "border border-[var(--accent-blue)]/35 bg-[var(--accent-blue)]/10",
        "px-2.5 py-1 text-[11px]",
        "text-[var(--text-secondary)]",
        className,
      )}
    >
      <Trophy size={11} className="text-[var(--accent-blue)]" aria-hidden />
      <span className="truncate max-w-[180px] sm:max-w-none">
        {label ?? "Mérkőzéshez kötött"}
      </span>
    </span>
  );
}
