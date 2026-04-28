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

interface MatchesTableProps {
  matches: Match[];
  /** Override the auto-derived status (used for the "past" archive tab). */
  forcedStatus?: MatchStatusKind;
  className?: string;
}

/**
 * F20.1 — Desktop táblázatos meccslista.
 *
 * Glass panel wrapper with a sticky header. Each row is a thin one-line
 * summary (date · home crest+name · vs. · away crest+name · competition ·
 * status pill · "Vásárlás" link). Hover lifts the row's glass background
 * a touch, signalling tappability without copying the heavier card hover.
 *
 * Sorting: rendered in the order received from the API (the listing page
 * already requests `scope=upcoming` / `scope=past`, sorted server-side by
 * date ASC / DESC respectively). The component itself is presentation-only
 * — it does not re-sort or filter.
 *
 * The "Jegy" column shows a "Vásárlás" link only for matches whose status
 * resolves to "available". For "soon" / "past" matches we render a quiet
 * em-dash so the column visually balances without claiming a CTA the user
 * can't act on yet.
 */
export function MatchesTable({
  matches,
  forcedStatus,
  className,
}: MatchesTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "glass-card relative overflow-hidden",
        // The internal scroll wrapper handles overflow on narrow desktops.
        className,
      )}
    >
      <div className="relative max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead
            className={cn(
              // sticky header — sits inside the rounded glass panel
              "sticky top-0 z-10",
              "bg-[var(--glass-bg-strong)] backdrop-blur-md",
              "border-b border-[var(--glass-border)]",
            )}
          >
            <tr>
              <Th className="w-[180px] pl-6">Dátum</Th>
              <Th>Hazai csapat</Th>
              <Th
                className="w-[40px] text-center text-[var(--text-muted)]"
                aria-hidden
              >
                –
              </Th>
              <Th>Vendég csapat</Th>
              <Th className="w-[180px]">Bajnokság</Th>
              <Th className="w-[200px]">Státusz</Th>
              <Th className="w-[140px] pr-6 text-right">Jegy</Th>
            </tr>
          </thead>

          <tbody>
            {matches.map((match, i) => {
              const status = forcedStatus ?? deriveMatchStatus(match.date);
              const isAvailable = status === "available";
              const rowKey = match.id;

              return (
                <motion.tr
                  key={rowKey}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(i * 0.025, 0.25),
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  className={cn(
                    "border-b border-[var(--glass-border)] last:border-b-0",
                    "transition-colors duration-200",
                    "hover:bg-[var(--glass-bg-hover)]",
                  )}
                >
                  <Td className="pl-6 align-middle">
                    <time
                      dateTime={match.date}
                      className="block whitespace-nowrap text-sm text-[var(--text-primary)] tabular-nums"
                    >
                      {formatRowDate(match.date)}
                    </time>
                    <span className="mt-0.5 block text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                      {formatRowTime(match.date)}
                    </span>
                  </Td>

                  <Td className="align-middle">
                    <TeamPair
                      crest={match.home_team_crest}
                      name={match.home_team}
                    />
                  </Td>

                  <Td
                    className="text-center align-middle"
                    aria-hidden
                  >
                    <span className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--text-muted)]">
                      vs.
                    </span>
                  </Td>

                  <Td className="align-middle">
                    <TeamPair
                      crest={match.away_team_crest}
                      name={match.away_team}
                    />
                  </Td>

                  <Td className="align-middle">
                    <span className="block max-w-[180px] truncate text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                      {match.competition ?? "—"}
                    </span>
                  </Td>

                  <Td className="align-middle">
                    <MatchStatusBadge status={status} />
                  </Td>

                  <Td className="pr-6 text-right align-middle">
                    {isAvailable ? (
                      <Link
                        href={`/jegyek/${match.id}`}
                        className={cn(
                          "group/cta inline-flex items-center gap-1.5",
                          "rounded-full border border-[var(--accent-gold)]/40",
                          "bg-[var(--accent-gold)]/10 px-3.5 py-1.5",
                          "text-[11px] font-semibold uppercase tracking-[0.22em]",
                          "text-[var(--accent-gold)]",
                          "transition-all duration-200",
                          "hover:border-[var(--accent-gold)]/80 hover:bg-[var(--accent-gold)]/20",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                        )}
                      >
                        Vásárlás
                        <ArrowUpRight
                          size={13}
                          aria-hidden
                          className="transition-transform duration-200 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5"
                        />
                      </Link>
                    ) : status === "past" ? (
                      <Link
                        href={`/jegyek/${match.id}`}
                        className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-secondary)]"
                      >
                        Részletek
                      </Link>
                    ) : (
                      <span
                        className="text-[11px] uppercase tracking-[0.22em] text-[var(--text-muted)]"
                        aria-label="Vásárlás még nem elérhető"
                      >
                        —
                      </span>
                    )}
                  </Td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Cells / sub-bits
// ---------------------------------------------------------------------------

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-3 text-left",
        "font-display text-[10px] uppercase tracking-[0.28em]",
        "text-[var(--text-muted)]",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-4", className)}>{children}</td>;
}

function TeamPair({
  crest,
  name,
}: {
  crest: string | null;
  name: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <TeamCrest url={crest} teamName={name} size={24} />
      <span className="min-w-0 truncate text-sm font-medium text-[var(--text-primary)]">
        {name}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Date helpers — kept tight so the row stays single-line on 1280px
// ---------------------------------------------------------------------------

function formatRowDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatRowTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("hu-HU", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
