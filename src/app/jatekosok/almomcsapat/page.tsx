"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion } from "framer-motion";
import Link from "next/link";
import type { DreamTeam, DreamTeamFormation, Player } from "@/types/database";
import { fetchPlayers } from "@/lib/players-api";
import {
  createDreamTeam,
  deleteDreamTeam,
  fetchDreamTeams,
  updateDreamTeam,
} from "@/lib/dream-team-api";
import {
  FORMATIONS,
  type FormationSlot,
  describeSlotAccept,
  slotAcceptsPosition,
} from "@/lib/dream-team-formations";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useToast } from "@/providers/ToastProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { PitchSVG } from "@/components/dream-team/PitchSVG";
import { PlayerPool } from "@/components/dream-team/PlayerPool";
import { FormationSelector } from "@/components/dream-team/FormationSelector";
import { DreamTeamToolbar } from "@/components/dream-team/DreamTeamToolbar";
import { DeleteConfirmModal } from "@/components/dream-team/DeleteConfirmModal";
import { DraggablePlayerCard } from "@/components/dream-team/DraggablePlayerCard";
import { cn } from "@/lib/utils";

/**
 * /jatekosok/almomcsapat
 *
 * Drag-and-drop álomcsapat szerkesztő (F22).
 *
 * State model:
 *   - `formation`     → kiválasztott formáció (4 közül),
 *   - `placements`    → slotIndex → playerId táblázat (csak elhelyezettek),
 *   - `name`          → csapat neve, perzisztált,
 *   - `loadedTeam`    → utoljára API-ból kapott csapat (id-vel) — ha null,
 *                       Mentés POST-ot küld; ha nem, PUT-ot.
 *   - `isDirty`       → form változott-e a betöltöttel képest.
 *
 * Backend egyezmény (Iteration 19):
 *   - GET /api/dream-team → { items: DreamTeam[] }, max 5.
 *     Az első (legfrissebb) csapatot töltjük be — a backlog alapján "egy"
 *     álomcsapat-szerkesztő mintával dolgozunk; a backend megengedi az
 *     5-ig tárolást, de az UI most csak a legutóbbira fókuszál.
 *
 * Mobil:
 *   - `useMediaQuery('(max-width: 768px)')` → tap-to-select fallback.
 *   - 1. tap a pool-on → `selectedPoolPlayerId` állítás,
 *   - 2. tap egy üres, kompatibilis sloton → elhelyezés.
 */
function DreamTeamPageInner() {
  const toast = useToast();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // ───────── data state ─────────
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingTeam, setLoadingTeam] = useState(true);

  const [formation, setFormation] = useState<DreamTeamFormation>("4-2-3-1");
  const [placements, setPlacements] = useState<
    Record<number, string | undefined>
  >({});
  const [name, setName] = useState<string>("Álomcsapatom");
  const [loadedTeam, setLoadedTeam] = useState<DreamTeam | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // ───────── drag + mobile selection ─────────
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<string | null>(
    null,
  );
  const [selectedPoolPlayerId, setSelectedPoolPlayerId] = useState<
    string | null
  >(null);

  // F27.5 — split mouse + touch into separate sensors. The single
  // PointerSensor we used previously caused two regressions on touch:
  //  1) iOS Safari sometimes skipped the activation distance and fired
  //     drag immediately, which made the page un-scrollable above the
  //     pitch.
  //  2) On Android Chrome a 5px distance was too tight to disambiguate
  //     scroll-intent from drag-intent when the user's finger drifted.
  // The TouchSensor's `delay`-based activation (long-press) is the
  // canonical dnd-kit recipe for mobile lists/grids.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  // ───────── load squad + saved team in parallel ─────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [squad, teams] = await Promise.all([
          fetchPlayers(),
          fetchDreamTeams(),
        ]);
        if (cancelled) return;
        setAllPlayers(squad);
        setLoadingPlayers(false);

        // Pick the most recent team (already sorted DESC by created_at).
        const latest = teams[0] ?? null;
        if (latest) {
          setLoadedTeam(latest);
          setFormation(latest.formation);
          setName(latest.name);
          // Filter to playerIds that still exist in the squad — defensive
          // against players removed from the keret since the team was saved.
          const validIds = new Set(squad.map((p) => p.id));
          const next: Record<number, string | undefined> = {};
          for (const slot of latest.players) {
            if (validIds.has(slot.playerId)) {
              next[slot.slotIndex] = slot.playerId;
            }
          }
          setPlacements(next);
        }
        setLoadingTeam(false);
      } catch (err) {
        if (cancelled) return;
        setLoadingPlayers(false);
        setLoadingTeam(false);
        toast.error(
          err instanceof Error
            ? err.message
            : "Adatok betöltése sikertelen",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  // ───────── derived state ─────────
  const playerById = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const p of allPlayers) map[p.id] = p;
    return map;
  }, [allPlayers]);

  const placedPlayerIds = useMemo(() => {
    const set = new Set<string>();
    for (const v of Object.values(placements)) if (v) set.add(v);
    return set;
  }, [placements]);

  const placedCount = placedPlayerIds.size;

  // Drag-time position resolution — used by PitchSVG to highlight slots.
  const draggingPosition = activeDragPlayerId
    ? (playerById[activeDragPlayerId]?.position ?? null)
    : null;

  // Detect "dirty" — compare current state against loadedTeam.
  const isDirty = useMemo(() => {
    if (!loadedTeam) return placedCount > 0 || name !== "Álomcsapatom";
    if (loadedTeam.formation !== formation) return true;
    if ((loadedTeam.name ?? "") !== name) return true;

    const savedSlots = new Map(
      loadedTeam.players.map((s) => [s.slotIndex, s.playerId]),
    );
    const currentSlots = new Map(
      Object.entries(placements)
        .filter(([, v]) => Boolean(v))
        .map(([k, v]) => [Number(k), v as string]),
    );
    if (savedSlots.size !== currentSlots.size) return true;
    for (const [k, v] of savedSlots) {
      if (currentSlots.get(k) !== v) return true;
    }
    return false;
  }, [loadedTeam, formation, name, placements, placedCount]);

  // ───────── formation changes ─────────
  // When the new formation has fewer slots OR a slot's accepted positions
  // change, drop the now-invalid placements back into the pool.
  const handleFormationChange = useCallback(
    (next: DreamTeamFormation) => {
      if (next === formation) return;
      const oldSlots = FORMATIONS[formation];
      const newSlots = FORMATIONS[next];
      // newSlots is always 11 long, but slot roles can change per index.
      // Strategy: try to keep the same slotIndex when the role accepts the
      // existing player, else drop it.
      const carry: Record<number, string | undefined> = {};
      for (const slot of newSlots) {
        const existingPlayerId = placements[slot.slotIndex];
        if (!existingPlayerId) continue;
        const existingPlayer = playerById[existingPlayerId];
        if (
          existingPlayer &&
          slotAcceptsPosition(slot, existingPlayer.position)
        ) {
          carry[slot.slotIndex] = existingPlayerId;
        }
      }
      const droppedCount =
        oldSlots.reduce(
          (acc, s) => (placements[s.slotIndex] ? acc + 1 : acc),
          0,
        ) - Object.keys(carry).length;
      setFormation(next);
      setPlacements(carry);
      if (droppedCount > 0) {
        toast.info(
          `${droppedCount} játékos visszakerült a poolba az új formáció miatt.`,
        );
      }
    },
    [formation, placements, playerById, toast],
  );

  // ───────── DnD handlers ─────────
  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as
      | { kind?: string; player?: Player }
      | undefined;
    if (data?.kind === "player" && data.player) {
      setActiveDragPlayerId(data.player.id);
    }
  };

  const placePlayerOnSlot = useCallback(
    (slot: FormationSlot, player: Player) => {
      if (!slotAcceptsPosition(slot, player.position)) {
        toast.error(
          `Erre a pozícióra csak ${describeSlotAccept(slot)} kerülhet!`,
        );
        return false;
      }
      setPlacements((prev) => {
        const next = { ...prev };
        // F27.5 — true swap semantics:
        //  1. Find the player's previous slot (if any).
        //  2. Find who currently sits on the target slot (the "displaced").
        //  3. If both exist AND the displaced fits the source slot's role,
        //     they swap places. Otherwise the displaced quietly returns to
        //     the pool (the historical behaviour) and the source slot is
        //     emptied. We never silently drop the displaced player without
        //     a trace, which was the regression report behind the task.
        let sourceSlotIndex: number | null = null;
        for (const k of Object.keys(next)) {
          if (next[Number(k)] === player.id) {
            sourceSlotIndex = Number(k);
            break;
          }
        }

        const displacedPlayerId = next[slot.slotIndex];

        // Clear source slot first.
        if (sourceSlotIndex !== null) delete next[sourceSlotIndex];

        // Place the dragged player on the target.
        next[slot.slotIndex] = player.id;

        // Try to place the displaced player back onto the source slot, but
        // only if they fit that role. If not, they fall through to the pool.
        if (
          displacedPlayerId &&
          displacedPlayerId !== player.id &&
          sourceSlotIndex !== null
        ) {
          const displaced = playerById[displacedPlayerId];
          const sourceSlot = FORMATIONS[formation].find(
            (s) => s.slotIndex === sourceSlotIndex,
          );
          if (
            displaced &&
            sourceSlot &&
            slotAcceptsPosition(sourceSlot, displaced.position)
          ) {
            next[sourceSlotIndex] = displacedPlayerId;
          }
        }
        return next;
      });
      return true;
    },
    [toast, formation, playerById],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const playerId = activeDragPlayerId;
    setActiveDragPlayerId(null);

    if (!playerId || !event.over) return;
    const overData = event.over.data.current as
      | { kind?: string; slot?: FormationSlot }
      | undefined;
    if (overData?.kind !== "slot" || !overData.slot) return;

    const player = playerById[playerId];
    if (!player) return;
    placePlayerOnSlot(overData.slot, player);
  };

  const handleDragCancel = () => setActiveDragPlayerId(null);

  // ───────── slot interactions ─────────
  const handleSlotTap = useCallback(
    (slot: FormationSlot) => {
      // Mobile path: tap-to-place. Desktop tap on a slot does nothing
      // (drag is the canonical interaction), but we still allow the user
      // to click an empty slot to "consume" the armed selection on mobile.
      if (!isMobile) return;
      if (selectedPoolPlayerId) {
        const player = playerById[selectedPoolPlayerId];
        if (!player) return;
        // If the slot is already occupied, we still move/replace.
        const ok = placePlayerOnSlot(slot, player);
        if (ok) setSelectedPoolPlayerId(null);
      }
    },
    [isMobile, placePlayerOnSlot, playerById, selectedPoolPlayerId],
  );

  const handleRemoveFromSlot = useCallback((slotIndex: number) => {
    setPlacements((prev) => {
      const next = { ...prev };
      delete next[slotIndex];
      return next;
    });
  }, []);

  // ───────── persistence ─────────
  const buildPayload = useCallback(() => {
    const players = Object.entries(placements)
      .filter(([, v]) => Boolean(v))
      .map(([slotIndexStr, playerId]) => {
        const slotIndex = Number(slotIndexStr);
        const slot = FORMATIONS[formation].find(
          (s) => s.slotIndex === slotIndex,
        );
        return {
          slotIndex,
          playerId: playerId as string,
          // Persist the slot's role label as the "position" string so the
          // backend has a non-empty value (validation requires it).
          position: slot?.role ?? "GK",
        };
      });
    const trimmedName = name.trim().length > 0 ? name.trim() : "Álomcsapatom";
    return {
      formation,
      name: trimmedName,
      players,
    } as const;
  }, [formation, name, placements]);

  const handleSave = useCallback(async () => {
    if (placedCount === 0) {
      toast.error("Helyezz el legalább egy játékost mentés előtt.");
      return;
    }
    setIsSaving(true);
    try {
      const payload = buildPayload();
      const saved = loadedTeam
        ? await updateDreamTeam(loadedTeam.id, payload)
        : await createDreamTeam(payload);
      setLoadedTeam(saved);
      toast.success(
        loadedTeam ? "Álomcsapat frissítve" : "Álomcsapat elmentve",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Mentés sikertelen",
      );
    } finally {
      setIsSaving(false);
    }
  }, [buildPayload, loadedTeam, placedCount, toast]);

  const handleReset = useCallback(() => {
    setPlacements({});
    setSelectedPoolPlayerId(null);
    // Keep the name + formation — only the placements reset, mirroring
    // "fresh start with the same template".
    toast.info("A pálya kiürült. Helyezz el új játékosokat!");
  }, [toast]);

  const handleConfirmDelete = useCallback(async () => {
    if (!loadedTeam) return;
    setIsDeleting(true);
    try {
      await deleteDreamTeam(loadedTeam.id);
      setLoadedTeam(null);
      setPlacements({});
      setName("Álomcsapatom");
      setFormation("4-2-3-1");
      setDeleteModalOpen(false);
      toast.success("Álomcsapat törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Törlés sikertelen");
    } finally {
      setIsDeleting(false);
    }
  }, [loadedTeam, toast]);

  const activeDraggedPlayer = activeDragPlayerId
    ? playerById[activeDragPlayerId]
    : null;

  return (
    <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Page header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 sm:mb-8"
      >
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/jatekosok"
            className="text-xs uppercase tracking-[0.3em] text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)]"
          >
            ← Keret
          </Link>
          <span className="text-[var(--text-secondary)]">/</span>
          <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
            Álomcsapatom
          </p>
        </div>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-4xl sm:text-6xl lg:text-7xl",
          )}
        >
          Építsd meg a tökéletes XI-et
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          Válaszd ki a formációt, majd húzd bármelyik játékost bármelyik
          pozícióra. Inverzszelső, hamis kilences, hátravont csatár — a
          kreativitásnak nincs határa.
        </p>
      </motion.header>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(320px,380px)_1fr] lg:gap-8">
          {/* Pool — appears first on mobile (above pitch is awkward),
              we'll flex-reorder so pitch comes first there. */}
          <div className="order-2 lg:order-1">
            <PlayerPool
              players={allPlayers}
              placedPlayerIds={placedPlayerIds}
              isMobile={isMobile}
              selectedPoolPlayerId={selectedPoolPlayerId}
              onSelectPoolPlayer={setSelectedPoolPlayerId}
              loading={loadingPlayers}
            />
          </div>

          {/* Right column — formation selector, pitch, toolbar */}
          <div className="order-1 flex flex-col gap-4 lg:order-2">
            {/* Formation row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-display text-sm uppercase tracking-[0.3em] text-[var(--text-secondary)]">
                Formáció
              </p>
              <FormationSelector
                current={formation}
                onChange={handleFormationChange}
              />
            </div>

            {/* Pitch — wraps in glass card with subtle gold inner border */}
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-strong)]",
                "p-2 sm:p-3 shadow-[var(--shadow-md)]",
              )}
            >
              {loadingTeam ? (
                <div className="aspect-[8/11] w-full animate-pulse rounded-xl bg-[var(--glass-bg-hover)]" />
              ) : (
                <PitchSVG
                  formation={formation}
                  placements={placements}
                  playerById={playerById}
                  draggingPosition={draggingPosition}
                  selectedPoolPlayerId={selectedPoolPlayerId}
                  onSlotTap={handleSlotTap}
                  onRemovePlayer={handleRemoveFromSlot}
                  isMobile={isMobile}
                />
              )}
            </div>

            {/* Mobile selected-player banner */}
            {isMobile && selectedPoolPlayerId && playerById[selectedPoolPlayerId] && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "rounded-xl border border-[var(--accent-gold)] bg-[var(--glass-bg-strong)]",
                  "px-4 py-2 text-xs text-[var(--text-primary)] shadow-[var(--shadow-glow-gold)]",
                  "flex items-center justify-between gap-3",
                )}
              >
                <span>
                  <span className="text-[var(--accent-gold)]">
                    {playerById[selectedPoolPlayerId].name}
                  </span>
                  {" "}— koppints egy pozícióra a pályán.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPoolPlayerId(null)}
                  className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  aria-label="Kiválasztás megszakítása"
                >
                  ✕
                </button>
              </motion.div>
            )}

            {/* Toolbar */}
            <DreamTeamToolbar
              hasSavedTeam={loadedTeam !== null}
              isDirty={isDirty}
              isSaving={isSaving}
              isDeleting={isDeleting}
              placedCount={placedCount}
              name={name}
              onNameChange={setName}
              onSave={handleSave}
              onReset={handleReset}
              onRequestDelete={() => setDeleteModalOpen(true)}
            />
          </div>
        </div>

        {/* Drag overlay — ghost preview of the card under the cursor */}
        <DragOverlay dropAnimation={null}>
          {activeDraggedPlayer ? (
            <div className="w-[260px] rotate-[-2deg] opacity-95">
              <DraggablePlayerCard
                player={activeDraggedPlayer}
                isPlaced={false}
                isMobile={false}
                isSelected={false}
                onTap={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <DeleteConfirmModal
        open={deleteModalOpen}
        teamName={loadedTeam?.name ?? "Álomcsapatom"}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setDeleteModalOpen(false)}
      />
    </div>
  );
}

export default function DreamTeamPage() {
  return (
    <ProtectedRoute>
      <DreamTeamPageInner />
    </ProtectedRoute>
  );
}
