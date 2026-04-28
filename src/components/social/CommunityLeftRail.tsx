"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MessageCircle, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import type { Match } from "@/types/database";
import { fetchNextMatch } from "@/lib/dashboard-api";
import { useCountdown } from "@/hooks/useCountdown";
import { TeamCrest } from "@/components/tickets/TeamCrest";
import { cn } from "@/lib/utils";

/**
 * Left navigation rail on /kozosseg (desktop only, ≥1024px).
 *
 * Two stacked glass cards:
 *  1. A vertical nav with two entries — "Friss feed" (active) and
 *     "Üzenetek" (link to /kozosseg/uzenetek).
 *  2. A compact "Következő mérkőzés" widget — a slimmed-down sibling
 *     of the dashboard NextMatchWidget. We re-implement the visuals
 *     instead of importing the dashboard one because that one is
 *     designed to span two grid columns and its proportions don't
 *     work in a 240px column.
 *
 * The left rail is a sticky element so it stays visible while the
 * caller scrolls the feed. We pin it to `top-24` to clear the floating
 * navbar pill.
 */
interface CommunityLeftRailProps {
  /** "feed" or "messages" — drives the active highlight. */
  active: "feed" | "messages";
}

export function CommunityLeftRail({ active }: CommunityLeftRailProps) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const next = await fetchNextMatch(c.signal);
        if (c.signal.aborted) return;
        setMatch(next);
      } catch {
        /* swallow — the rail tolerates a missing match */
      } finally {
        if (!c.signal.aborted) setLoaded(true);
      }
    })();
    return () => c.abort();
  }, []);

  return (
    <aside className="sticky top-24 hidden w-[240px] shrink-0 flex-col gap-5 lg:flex">
      <NavCard active={active} />
      <NextMatchMini match={match} loaded={loaded} />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Nav card                                                           */
/* ------------------------------------------------------------------ */

function NavCard({ active }: { active: "feed" | "messages" }) {
  const items: {
    id: "feed" | "messages";
    href: string;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "feed", href: "/kozosseg", label: "Friss feed", icon: Newspaper },
    {
      id: "messages",
      href: "/kozosseg/uzenetek",
      label: "Üzenetek",
      icon: MessageCircle,
    },
  ];

  return (
    <motion.nav
      aria-label="Közösség navigáció"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass-card p-2"
    >
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5",
                  "text-sm transition-colors duration-200",
                  isActive
                    ? "bg-[var(--accent-gold)]/[0.09] text-[var(--accent-gold)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
                )}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-1.5 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-[var(--accent-gold)]"
                  />
                )}
                <Icon
                  size={16}
                  className={cn(
                    "shrink-0",
                    isActive
                      ? "text-[var(--accent-gold)]"
                      : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "font-display uppercase tracking-[0.16em] text-[11px]",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}

/* ------------------------------------------------------------------ */
/* Compact next-match widget                                          */
/* ------------------------------------------------------------------ */

function NextMatchMini({
  match,
  loaded,
}: {
  match: Match | null;
  loaded: boolean;
}) {
  const cd = useCountdown(match?.date ?? null);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
      className="glass-card relative overflow-hidden p-4"
      aria-label="Következő mérkőzés"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />
      <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
        Köv. mérkőzés
      </p>

      {!loaded ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        </div>
      ) : !match ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <CalendarDays size={14} aria-hidden />
          <span>Nincs ütemezett meccs.</span>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <TeamCrest
              url={match.home_team_crest}
              teamName={match.home_team}
              size={22}
            />
            <span
              aria-hidden
              className="font-display text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]"
            >
              vs
            </span>
            <TeamCrest
              url={match.away_team_crest}
              teamName={match.away_team}
              size={22}
            />
          </div>
          <p className="mt-2 truncate font-display text-base leading-tight tracking-wide text-[var(--text-primary)]">
            {match.home_team.split(" ")[0]} –{" "}
            {match.away_team.split(" ")[0]}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <MiniCell value={cd.days} label="nap" />
            <MiniCell value={cd.hours} label="óra" />
            <MiniCell value={cd.minutes} label="perc" accent />
          </div>

          <Link
            href="/jegyek"
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 text-[11px]",
              "uppercase tracking-[0.2em] text-[var(--text-secondary)]",
              "transition-colors duration-200 hover:text-[var(--accent-gold)]",
            )}
          >
            Jegyek
          </Link>
        </>
      )}
    </motion.section>
  );
}

function MiniCell({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-sm)]",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)] py-1.5",
        accent && "border-[var(--accent-gold)]/40",
      )}
    >
      <span
        className={cn(
          "font-display text-base leading-none tabular-nums",
          accent ? "text-[var(--accent-gold)]" : "text-[var(--text-primary)]",
        )}
      >
        {value.toString().padStart(2, "0")}
      </span>
      <span className="mt-0.5 text-[8px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}
