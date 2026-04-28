"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "@/types/database";
import { isPlayerPosition } from "@/lib/constants";
import {
  PLAYER_POSITION_LABELS,
  PLAYER_POSITION_SHORT,
} from "@/lib/player-positions";
import { cn } from "@/lib/utils";

interface DraggablePlayerCardProps {
  player: Player;
  /** True if the player is already on the pitch — disables drag + dims. */
  isPlaced: boolean;
  /** True on touch devices: tap-to-select replaces drag. */
  isMobile: boolean;
  /** Mobile only: this player is currently armed for placement. */
  isSelected: boolean;
  /** Mobile only: tap handler — toggles selection. */
  onTap: () => void;
}

/**
 * Egy mini játékos kártya a bal oldali pool-ban.
 *
 * Desktop: `useDraggable` + `transform` styling. Touch device: a drag
 * letiltva, kattintásra a felső állapot toggle-li a kiválasztást
 * (tap-to-select fallback).
 *
 * Vizuális: kis kerek fotó, név, mezszám, pozíció rövidítés. Pulse
 * animáció + arany glow ha mobilon ki van választva.
 */
export function DraggablePlayerCard({
  player,
  isPlaced,
  isMobile,
  isSelected,
  onTap,
}: DraggablePlayerCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `pool-${player.id}`,
      data: { kind: "player", player },
      disabled: isPlaced || isMobile,
    });

  const positionLabel =
    player.position && isPlayerPosition(player.position)
      ? PLAYER_POSITION_LABELS[player.position]
      : (player.position ?? "");
  const positionShort =
    player.position && isPlayerPosition(player.position)
      ? PLAYER_POSITION_SHORT[player.position]
      : "";

  const style = {
    transform: CSS.Translate.toString(transform),
    touchAction: isMobile ? undefined : "none",
  } as React.CSSProperties;

  return (
    <button
      type="button"
      ref={setNodeRef as unknown as React.Ref<HTMLButtonElement>}
      style={style}
      onClick={isMobile && !isPlaced ? onTap : undefined}
      disabled={isPlaced}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5",
        "border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md",
        "text-left transition-all duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
        // Desktop hover lift
        !isPlaced && "hover:border-[var(--accent-gold)]/60 hover:bg-[var(--glass-bg-hover)]",
        // Drag cursor on desktop
        !isPlaced && !isMobile && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40 cursor-grabbing",
        // Already placed → dim + locked
        isPlaced && "opacity-40 cursor-not-allowed",
        // Mobile selection glow
        isSelected && [
          "border-[var(--accent-gold)] bg-[rgba(196,163,77,0.12)]",
          "shadow-[0_0_0_1px_var(--accent-gold),0_8px_24px_rgba(196,163,77,0.25)]",
        ],
      )}
      aria-label={
        isMobile
          ? isSelected
            ? `${player.name} kiválasztva. Koppints egy slotra a pályán az elhelyezéshez.`
            : `${player.name}. Koppints a kiválasztáshoz.`
          : `${player.name} – húzd a pályára`
      }
      aria-pressed={isSelected}
    >
      {/* Avatar */}
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
        {player.image_url ? (
          <Image
            src={player.image_url}
            alt=""
            fill
            sizes="40px"
            className="object-cover object-top"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--accent-gold)]">
            {player.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>

      {/* Name + position */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
          {player.name}
        </span>
        <span className="block truncate text-[11px] uppercase tracking-wider text-[var(--text-secondary)]">
          {positionShort && <span className="mr-1.5 font-display text-[var(--accent-gold)]">{positionShort}</span>}
          {positionLabel}
        </span>
      </span>

      {/* Jersey number */}
      {player.number !== null && (
        <span className="font-display text-lg leading-none text-[var(--accent-gold)] tabular-nums">
          {player.number}
        </span>
      )}
    </button>
  );
}
