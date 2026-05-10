"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Match } from "@/types/database";
import { fetchMatches } from "@/lib/tickets-api";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/providers/ToastProvider";
import { MatchesTable } from "@/components/tickets/MatchesTable";
import { MatchListMobile } from "@/components/tickets/MatchListMobile";
import { MatchesTableSkeleton } from "@/components/tickets/MatchesTableSkeleton";
import { MatchListEmptyState } from "@/components/tickets/MatchListEmptyState";
import { cn } from "@/lib/utils";

/**
 * /jegyek — public match list (F20.1 — táblázatos nézet).
 *
 * The previous card-grid was hard to scan once a season's worth of
 * matches accumulated. F20 replaces it with a sticky-header table on
 * desktop and a vertical strip-list on mobile (≤768px), driven by the
 * same Match[] payload.
 *
 * Behaviour:
 *  - Lands on the "upcoming" scope by default; a segmented control lets
 *    the user pivot to the past archive without leaving the page.
 *  - Each scope is fetched independently. Switching tabs shows a skeleton
 *    rather than the previous tab's data so the user never sees stale
 *    upcoming matches under a "Lejátszott" heading.
 *  - Past matches are forced into the "past" status — the table shows a
 *    quiet "Részletek" link instead of a "Vásárlás" CTA in their row.
 *
 * No auth: the listing itself is public. Auth is enforced once the user
 * tries to actually purchase, which is handled by the detail page.
 */

type Scope = "upcoming" | "past";

const SCOPE_TABS: { value: Scope; label: string }[] = [
  { value: "upcoming", label: "Közelgő mérkőzések" },
  { value: "past", label: "Lejátszott mérkőzések" },
];

export default function JegyekPage() {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>("upcoming");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * F27.4 — A "Jegyvásárlás elérhető" badge csak akkor szólalhat meg, ha a
   * meccshez tényleg konfiguráltunk szektorokat a `match_sectors` táblában.
   * Az `/api/matches` listázó endpoint ezt nem közvetíti, így egyetlen
   * Supabase query-vel begyűjtjük a sector match_id-kat és a frontenden
   * építünk egy lookup Set-et, amelyet a tábla / mobil lista átkap a
   * státusz pillulájához.
   */
  const [matchesWithSectors, setMatchesWithSectors] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const controller = new AbortController();

    // Async IIFE keeps setState out of the synchronous effect body,
    // satisfying eslint-config-next under React 19.
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchMatches(
          { scope, limit: 50 },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setMatches(data);

        // Sector lookup — a single `IN (...)` query against match_sectors.
        // We only need the match_id distinct list, so the payload stays
        // tiny even on a 50-match page.
        if (data.length > 0) {
          const supabase = createClient();
          const { data: sectorRows, error } = await supabase
            .from("match_sectors")
            .select("match_id")
            .in(
              "match_id",
              data.map((m) => m.id),
            );
          if (controller.signal.aborted) return;
          if (!error && sectorRows) {
            setMatchesWithSectors(
              new Set(
                (sectorRows as { match_id: string }[]).map((r) => r.match_id),
              ),
            );
          } else {
            setMatchesWithSectors(new Set());
          }
        } else {
          setMatchesWithSectors(new Set());
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Meccsek betöltése sikertelen",
        );
        setMatches([]);
        setMatchesWithSectors(new Set());
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [scope, toast]);

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      {/* Page header */}
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="space-y-4"
      >
        <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[var(--accent-gold)]">
          Jegyrendszer
        </p>
        <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl lg:text-7xl">
          Mérkőzések
          <br />
          <span className="text-[var(--text-secondary)]">naptára</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
          A teljes szezon hazai és idegenbeli meccsei. Válaszd ki a találkozót,
          foglalj le szektort a stadion térképén, és vidd haza a digitális
          jegyedet pár kattintással.
        </p>
      </motion.header>

      {/* Scope segmented control */}
      <div
        role="tablist"
        aria-label="Mérkőzések szűrője"
        className={cn(
          "mt-10 inline-flex items-center gap-1 rounded-full p-1",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md",
        )}
      >
        {SCOPE_TABS.map((tab) => {
          const active = scope === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setScope(tab.value)}
              className={cn(
                "rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.18em]",
                "transition-colors duration-200",
                active
                  ? "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="mt-8">
        {loading ? (
          <MatchesTableSkeleton />
        ) : matches.length === 0 ? (
          <MatchListEmptyState scope={scope} />
        ) : (
          <>
            {/* Desktop / tablet ≥ 768px → table */}
            <div className="hidden md:block">
              <MatchesTable
                matches={matches}
                forcedStatus={scope === "past" ? "past" : undefined}
                matchesWithSectors={matchesWithSectors}
              />
            </div>

            {/* Mobile → vertical strip list */}
            <div className="md:hidden">
              <MatchListMobile
                matches={matches}
                forcedStatus={scope === "past" ? "past" : undefined}
                matchesWithSectors={matchesWithSectors}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
