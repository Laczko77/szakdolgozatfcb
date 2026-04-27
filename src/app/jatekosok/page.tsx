"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Player } from "@/types/database";
import {
  PLAYER_POSITIONS,
  isPlayerPosition,
  type PlayerPosition,
} from "@/lib/constants";
import { fetchPlayers } from "@/lib/players-api";
import { useToast } from "@/providers/ToastProvider";
import {
  PositionPills,
  type PositionFilterValue,
} from "@/components/players/PositionPills";
import { PositionSection } from "@/components/players/PositionSection";
import { PlayerGridSkeleton } from "@/components/players/PlayerCardSkeleton";
import { cn } from "@/lib/utils";

/**
 * /jatekosok — public squad page.
 *
 * Behaviour:
 *  - Single fetch on mount returns the entire squad (≈30 rows). The
 *    position filter then operates client-side: the user gets instant
 *    transitions between Mind / Kapus / Védő / … with no extra round-trip.
 *  - The server already sorts by position rank then jersey number, so we
 *    just bucket players into the four PLAYER_POSITIONS groups in render.
 *  - URL state mirroring: `?position=Goalkeeper` etc. for shareable links.
 */

function JatekosokPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const initialPosition = readPositionFromQuery(searchParams.get("position"));

  const [players, setPlayers] = useState<Player[]>([]);
  const [position, setPosition] = useState<PositionFilterValue>(initialPosition);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const loadSquad = useCallback(async () => {
    try {
      // Always fetch the full squad — filtering is client-side.
      const list = await fetchPlayers();
      setPlayers(list);
      setErrored(false);
    } catch (err) {
      setErrored(true);
      toast.error(
        err instanceof Error ? err.message : "Játékosok betöltése sikertelen",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void (async () => {
      await loadSquad();
    })();
  }, [loadSquad]);

  // Mirror the active filter into the URL.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (position) params.set("position", position);
    else params.delete("position");

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(`/jatekosok${next ? `?${next}` : ""}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // Group + filter the squad. Computed once per (players, position) tuple.
  const grouped = useMemo(
    () => groupByPosition(players, position),
    [players, position],
  );

  // Per-position counts driven from the unfiltered squad — they should
  // not jitter when the user toggles filters.
  const counts = useMemo(() => {
    const result: Partial<Record<PlayerPosition | "all", number>> = {
      all: players.length,
    };
    for (const p of PLAYER_POSITIONS) {
      result[p] = players.filter((pl) => pl.position === p).length;
    }
    return result;
  }, [players]);

  const visibleCount = useMemo(
    () => grouped.reduce((sum, [, list]) => sum + list.length, 0),
    [grouped],
  );

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Page header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 sm:mb-12"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // A keret
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-5xl sm:text-7xl lg:text-[5.5rem]",
          )}
        >
          Játékosaink
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          A teljes első csapat egy helyen — kapusoktól a támadókig. Vidd
          kurzort egy kártya fölé a részletes statisztikákért, vagy
          kattints a teljes profilért.
        </p>
      </motion.header>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        className="mb-8 sm:mb-10"
      >
        <PositionPills
          active={position}
          onChange={setPosition}
          counts={counts}
        />
      </motion.div>

      {/* Result meta */}
      {!loading && !errored && (
        <p
          className="mb-8 text-sm text-[var(--text-secondary)]"
          aria-live="polite"
        >
          {visibleCount === 0
            ? "Nincs találat ebben a pozícióban."
            : position
              ? `${visibleCount} játékos a kiválasztott pozícióban`
              : `${visibleCount} játékos összesen`}
        </p>
      )}

      {/* Body */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <PlayerGridSkeleton count={12} />
          </motion.div>
        ) : errored ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)]",
              "p-8 text-center",
            )}
            role="alert"
          >
            <h2 className="font-display text-2xl text-[var(--text-primary)]">
              A keret pillanatnyilag nem érhető el
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Próbáld újra egy pillanat múlva.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadSquad();
              }}
              className="glass-button-secondary mt-5"
            >
              Újrapróbálás
            </button>
          </motion.div>
        ) : visibleCount === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)]",
              "p-10 text-center",
            )}
          >
            <p className="font-display text-3xl tracking-wide text-[var(--text-primary)]">
              Üres a pálya
            </p>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              Ebben a pozícióban most nincs játékos. Próbálj egy másikat.
            </p>
            <button
              type="button"
              onClick={() => setPosition("")}
              className="glass-button-secondary mt-5"
            >
              Mind mutatása
            </button>
          </motion.div>
        ) : (
          <motion.div
            key={`grouped-${position || "all"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-12 sm:space-y-16"
          >
            {grouped.map(([pos, list], sectionIdx) => (
              <PositionSection
                key={pos}
                position={pos}
                players={list}
                isFirstSection={sectionIdx === 0}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- helpers ---------- */

function readPositionFromQuery(raw: string | null): PositionFilterValue {
  if (!raw) return "";
  return isPlayerPosition(raw) ? raw : "";
}

/**
 * Bucket the squad into the four canonical positions, returning [position,
 * players] tuples in canonical order. When a single position is selected
 * we return only that bucket. Players whose `position` doesn't match any
 * known value are silently dropped (admin sync stores the football-data.org
 * value verbatim, so this should be empty in practice).
 */
function groupByPosition(
  players: Player[],
  filter: PositionFilterValue,
): ReadonlyArray<readonly [PlayerPosition, Player[]]> {
  const positions: ReadonlyArray<PlayerPosition> = filter
    ? [filter]
    : PLAYER_POSITIONS;
  return positions
    .map(
      (pos) =>
        [pos, players.filter((p) => p.position === pos)] as readonly [
          PlayerPosition,
          Player[],
        ],
    )
    .filter(([, list]) => list.length > 0);
}

/* ---------- export ---------- */

export default function JatekosokPage() {
  return (
    <Suspense fallback={<JatekosokFallback />}>
      <JatekosokPageInner />
    </Suspense>
  );
}

function JatekosokFallback() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-16 w-3/4 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
      <div className="mb-10 flex gap-2">
        {Array.from({ length: PLAYER_POSITIONS.length + 1 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-full bg-[var(--glass-bg-hover)]"
          />
        ))}
      </div>
      <PlayerGridSkeleton count={8} />
    </div>
  );
}
