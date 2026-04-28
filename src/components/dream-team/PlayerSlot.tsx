"use client";

import Image from "next/image";
import { useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import type { Player } from "@/types/database";
import type { FormationSlot } from "@/lib/dream-team-formations";
import { SLOT_ROLE_LABELS } from "@/lib/dream-team-formations";
import { cn } from "@/lib/utils";

interface PlayerSlotProps {
  slot: FormationSlot;
  player: Player | undefined;
  /** Drop-time compatibility: null = nothing being dragged. */
  isCompatible: boolean | null;
  /** True while *any* drag operation is in progress. */
  isDragging: boolean;
  /** Mobile tap-to-select: this slot is a valid target for the selected pool player. */
  armedForSelected: boolean;
  onTap: () => void;
  onRemove: () => void;
}

/**
 * Egy darab pozíció-cella a pályán. Két állapota van:
 *
 *  - üres slot → szerepkör címke + szaggatott körvonal,
 *  - elhelyezett játékos → kompakt kör/oval kártya képpel + névvel.
 *
 * Mindkét állapot droppable: a `useDroppable` `data` mezőben átadjuk a
 * teljes slotot, hogy a szülő `onDragEnd`-ben validálni tudjon.
 *
 * Drag közben:
 *   - `over === slot && isCompatible` → arany glow + skálázás,
 *   - `over === slot && !isCompatible` → vörös tint, "tilos" érzet,
 *   - `!over && isCompatible` → finom arany pulzálás (potenciális cél).
 */
export function PlayerSlot({
  slot,
  player,
  isCompatible,
  isDragging,
  armedForSelected,
  onTap,
  onRemove,
}: PlayerSlotProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${slot.slotIndex}`,
    data: { kind: "slot", slot },
  });

  const overOk = isOver && isCompatible === true;
  const overBad = isOver && isCompatible === false;
  const passiveOk = !isOver && isDragging && isCompatible === true;

  return (
    <motion.button
      ref={setNodeRef as unknown as React.Ref<HTMLButtonElement>}
      type="button"
      onClick={onTap}
      whileTap={{ scale: 0.96 }}
      className={cn(
        "group relative flex flex-col items-center justify-center",
        "h-20 w-20 sm:h-24 sm:w-24 lg:h-28 lg:w-28",
        "rounded-full outline-none transition-all duration-200",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
      )}
      aria-label={
        player
          ? `${player.name} – ${SLOT_ROLE_LABELS[slot.role]} pozíció. Kattintásra eltávolítható.`
          : `${SLOT_ROLE_LABELS[slot.role]} pozíció, üres slot.`
      }
    >
      {/* Outer glow / state ring */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-[-10px] rounded-full transition-opacity duration-200",
          overOk && "opacity-100",
          overBad && "opacity-100",
          passiveOk && "opacity-60 animate-pulse",
          !isOver && !passiveOk && "opacity-0",
        )}
        style={{
          background: overOk
            ? "radial-gradient(circle, rgba(196,163,77,0.5), transparent 65%)"
            : overBad
              ? "radial-gradient(circle, rgba(248,113,113,0.45), transparent 65%)"
              : passiveOk
                ? "radial-gradient(circle, rgba(196,163,77,0.3), transparent 65%)"
                : undefined,
        }}
      />

      {/* Mobile tap-to-select armed indicator */}
      {armedForSelected && !overOk && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[-6px] rounded-full border-2 border-dashed border-[var(--accent-gold)] animate-pulse"
        />
      )}

      {/* Slot body */}
      <span
        className={cn(
          "relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-full",
          "border backdrop-blur-md transition-colors duration-200",
          player
            ? "border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
            : "border-dashed border-white/35 bg-black/35",
          overOk && "border-[var(--accent-gold)] bg-[rgba(196,163,77,0.18)]",
          overBad && "border-red-400/70 bg-red-500/15",
        )}
      >
        {player ? (
          <>
            {/* Player headshot */}
            {player.image_url ? (
              <Image
                src={player.image_url}
                alt=""
                fill
                sizes="(max-width: 640px) 80px, (max-width: 1024px) 96px, 112px"
                className="object-cover object-top"
              />
            ) : (
              <span className="font-display text-xl text-[var(--accent-gold)]">
                {initials(player.name)}
              </span>
            )}

            {/* Bottom name + number plate */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-1 pb-1 pt-3 text-center"
            >
              <span className="block truncate text-[9px] font-semibold uppercase tracking-wider text-white sm:text-[10px]">
                {lastName(player.name)}
              </span>
              {player.number !== null && (
                <span className="font-display text-[10px] leading-none text-[var(--accent-gold)]">
                  #{player.number}
                </span>
              )}
            </span>

            {/* Remove button — appears on hover (desktop) or always (mobile) */}
            <span
              role="presentation"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className={cn(
                "absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center",
                "rounded-full border border-[var(--glass-border-hover)] bg-black/85",
                "text-white text-xs font-bold leading-none",
                "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                "transition-opacity duration-150",
                "[@media(hover:none)]:opacity-100",
              )}
              aria-label="Játékos eltávolítása"
            >
              ×
            </span>
          </>
        ) : (
          <>
            <span className="font-display text-base font-semibold tracking-wider text-white/85 sm:text-lg">
              {slot.role}
            </span>
            <span className="text-[8px] uppercase tracking-[0.25em] text-white/50 sm:text-[9px]">
              {SLOT_ROLE_LABELS[slot.role]}
            </span>
          </>
        )}
      </span>
    </motion.button>
  );
}

/* ---------- helpers ---------- */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
