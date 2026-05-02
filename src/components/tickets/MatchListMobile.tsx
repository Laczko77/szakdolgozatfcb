"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Match } from "@/types/database";
import { cn } from "@/lib/utils";
import {
  deriveMatchStatus,
  MatchStatusBadge,
  type MatchStatusKind,
} from "./MatchStatusBadge";
import { TeamCrest } from "./TeamCrest";

interface MatchListMobileProps {
  matches: Match[];
  forcedStatus?: MatchStatusKind;
  /**
   * F27.4 — a "Jegyvásárlás elérhető" pillula és a "Jegy" CTA csak akkor
   * jelenik meg, ha a meccs match.id-ja ebben a Set-ben szerepel. Lásd a
   * `MatchesTable` azonos prop-ját — itt ugyanaz a Set kerül átadásra a
   * `/jegyek` lapból.
   */
  matchesWithSectors?: ReadonlySet<string>;
  className?: string;
}

/**
 * F20.1 — Mobil fallback a táblázathoz.
 *
 * < 768px viewports get a vertical stack of thin glass strips. Each strip
 * crams the same info as the table row into two compact lines:
 *  - line 1: home crest+name · vs. · away crest+name
 *  - line 2: date + status badge + (optional) Vásárlás link
 *
 * No truncation tricks — `min-w-0` + `truncate` keep team names from
 * wrapping into a third line, since the strip is meant to read at a
 * glance.
 */
export function MatchListMobile({
  matches,
  forcedStatus,
  matchesWithSectors,
  className,
}: MatchListMobileProps) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {matches.map((match, i) => {
        const baseStatus = forcedStatus ?? deriveMatchStatus(match.date);
        // F27.4 — sectors nélküli meccs sosem mutathat "elérhető" pillulát.
        const status: MatchStatusKind =
          baseStatus === "available" &&
          matchesWithSectors !== undefined &&
          !matchesWithSectors.has(match.id)
            ? "soon"
            : baseStatus;
        const isAvailable = status === "available";

        return (
          <motion.li
            key={match.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.35,
              delay: Math.min(i * 0.03, 0.25),
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <Link
              href={`/jegyek/${match.id}`}
              className={cn(
                "block rounded-[var(--radius-md)] border p-4",
                "border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "backdrop-blur-md transition-colors duration-200",
                "hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              )}
            >
              {/* Line 1 — matchup */}
              <div className="flex items-center gap-2">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <TeamCrest
                    url={match.home_team_crest}
                    teamName={match.home_team}
                    size={22}
                  />
                  <span className="min-w-0 truncate text-sm font-medium text-[var(--text-primary)]">
                    {match.home_team}
                  </span>
                </span>

                <span
                  aria-hidden
                  className="font-display text-[9px] uppercase tracking-[0.4em] text-[var(--text-muted)]"
                >
                  vs.
                </span>

                <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                  <span className="min-w-0 truncate text-sm font-medium text-[var(--text-primary)]">
                    {match.away_team}
                  </span>
                  <TeamCrest
                    url={match.away_team_crest}
                    teamName={match.away_team}
                    size={22}
                  />
                </span>
              </div>

              {/* Line 2 — meta */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <time
                  dateTime={match.date}
                  className="text-[11px] tabular-nums text-[var(--text-secondary)]"
                >
                  {formatMobileDate(match.date)}
                </time>

                <div className="flex items-center gap-2">
                  <MatchStatusBadge status={status} />
                  {isAvailable && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full",
                        "border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/10",
                        "px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                        "text-[var(--accent-gold)]",
                      )}
                    >
                      Jegy
                      <ArrowUpRight size={11} aria-hidden />
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.li>
        );
      })}
    </ul>
  );
}

function formatMobileDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("hu-HU", {
    month: "short",
    day: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("hu-HU", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${datePart} · ${timePart}`;
}
