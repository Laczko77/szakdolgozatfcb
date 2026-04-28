"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/types/database";
import {
  PLAYER_POSITIONS,
  type PlayerPosition,
} from "@/lib/constants";
import {
  PLAYER_POSITION_LABELS_PLURAL,
  PLAYER_POSITION_SHORT,
} from "@/lib/player-positions";
import { DraggablePlayerCard } from "@/components/dream-team/DraggablePlayerCard";
import { cn } from "@/lib/utils";

interface PlayerPoolProps {
  players: Player[];
  /** Set of playerIds currently placed on the pitch. */
  placedPlayerIds: Set<string>;
  isMobile: boolean;
  selectedPoolPlayerId: string | null;
  onSelectPoolPlayer: (playerId: string | null) => void;
  /** True while the squad is still loading from the API. */
  loading: boolean;
}

type PoolFilter = "all" | PlayerPosition;

/**
 * Bal oldali játékos pool. Tartalmaz egy felső szűrő tab-sort, alatta
 * egy görgethető kártyalistát.
 *
 * Desktop: minden kártya draggable.
 * Mobil: a kártyák tap-pelhetők — kattintásra kiválaszt, második tap
 * a slot-on elhelyez (a pálya kezeli).
 *
 * A "már a pályán" state vizuálisan halványítva, kattintás-letiltva.
 */
export function PlayerPool({
  players,
  placedPlayerIds,
  isMobile,
  selectedPoolPlayerId,
  onSelectPoolPlayer,
  loading,
}: PlayerPoolProps) {
  const [filter, setFilter] = useState<PoolFilter>("all");

  const counts = useMemo(() => {
    const result: Record<PoolFilter, number> = {
      all: players.length,
      Goalkeeper: 0,
      Defender: 0,
      Midfielder: 0,
      Attacker: 0,
    };
    for (const p of players) {
      if (p.position && PLAYER_POSITIONS.includes(p.position as PlayerPosition)) {
        result[p.position as PlayerPosition] += 1;
      }
    }
    return result;
  }, [players]);

  const filtered = useMemo(() => {
    if (filter === "all") return players;
    return players.filter((p) => p.position === filter);
  }, [players, filter]);

  return (
    <aside
      className={cn(
        "flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md",
        "overflow-hidden shadow-[var(--shadow-md)]",
      )}
      aria-label="Választható játékosok"
    >
      {/* Header */}
      <div className="border-b border-[var(--glass-border)] px-4 pb-3 pt-4">
        <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Keret
        </p>
        <h2 className="mt-1 font-display text-2xl tracking-wide text-[var(--text-primary)]">
          Játékosaink
        </h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {isMobile
            ? "Koppints egy játékosra, majd egy slotra a pályán."
            : "Húzz egy játékost a megfelelő pozíciójú slotba."}
        </p>
      </div>

      {/* Position filter pills */}
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--glass-border)] px-3 py-3">
        <FilterPill
          active={filter === "all"}
          label="Mind"
          short="ALL"
          count={counts.all}
          onClick={() => setFilter("all")}
        />
        {PLAYER_POSITIONS.map((pos) => (
          <FilterPill
            key={pos}
            active={filter === pos}
            label={PLAYER_POSITION_LABELS_PLURAL[pos]}
            short={PLAYER_POSITION_SHORT[pos]}
            count={counts[pos]}
            onClick={() => setFilter(pos)}
          />
        ))}
      </div>

      {/* List body */}
      <div
        className={cn(
          "flex-1 space-y-1.5 overflow-y-auto px-3 py-3",
          // Custom scrollbar
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--glass-border-hover)]",
          "[&::-webkit-scrollbar-track]:bg-transparent",
        )}
        style={{ maxHeight: "min(70vh, 720px)" }}
      >
        {loading ? (
          <PoolSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-2 py-10 text-center text-sm text-[var(--text-secondary)]">
            Nincs ilyen pozíciójú játékos a keretben.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((player) => (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <DraggablePlayerCard
                  player={player}
                  isPlaced={placedPlayerIds.has(player.id)}
                  isMobile={isMobile}
                  isSelected={selectedPoolPlayerId === player.id}
                  onTap={() =>
                    onSelectPoolPlayer(
                      selectedPoolPlayerId === player.id ? null : player.id,
                    )
                  }
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </aside>
  );
}

/* ---------- sub components ---------- */

function FilterPill({
  active,
  label,
  short,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  short: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wider transition-all duration-150",
        "outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
        active
          ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] shadow-[0_0_0_1px_var(--accent-gold)]"
          : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:border-[var(--glass-border-hover)] hover:text-[var(--text-primary)]",
      )}
      aria-pressed={active}
    >
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short}</span>
      <span className="ml-1.5 text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  );
}

function PoolSkeleton() {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5"
        >
          <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            <div className="h-2 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
