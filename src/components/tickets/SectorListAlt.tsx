"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { SectorWithAvailability } from "@/lib/tickets-api";

interface SectorListAltProps {
  sectors: SectorWithAvailability[];
  selectedSectorId: string | null;
  onSelect: (sectorId: string) => void;
  className?: string;
}

/**
 * Touch-friendly alternative to the SVG stadium map.
 *
 * Renders every sector as a tappable card with the name, available/total
 * seats, price and a small status pill. Sold-out cards are disabled and
 * carry a lock icon — they can't take focus or trigger `onSelect`.
 *
 * On larger viewports this list is shown alongside the SVG (collapsed
 * into 1 column under it) — they're not mutually exclusive, they're two
 * lenses on the same data and stay in sync because they share the
 * `selectedSectorId` prop.
 */
export function SectorListAlt({
  sectors,
  selectedSectorId,
  onSelect,
  className,
}: SectorListAltProps) {
  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3",
        className,
      )}
    >
      {sectors.map((sector) => {
        const isSelected = sector.id === selectedSectorId;
        const isSoldOut = sector.is_sold_out;

        return (
          <li key={sector.id}>
            <button
              type="button"
              onClick={() => {
                if (!isSoldOut) onSelect(sector.id);
              }}
              disabled={isSoldOut}
              aria-pressed={isSelected}
              className={cn(
                "group flex w-full items-center justify-between gap-3",
                "rounded-[var(--radius-md)] border px-4 py-3 text-left",
                "transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                isSelected
                  ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 shadow-[var(--shadow-glow-gold)]"
                  : isSoldOut
                    ? "cursor-not-allowed border-dashed border-[var(--glass-border)] bg-transparent opacity-60"
                    : "border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
              )}
            >
              <span className="min-w-0 space-y-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-display text-base tracking-wide",
                      isSelected
                        ? "text-[var(--accent-gold)]"
                        : "text-[var(--text-primary)]",
                    )}
                  >
                    {sector.sector_name} szektor
                  </span>
                  {isSelected && (
                    <Check
                      size={14}
                      className="text-[var(--accent-gold)]"
                      aria-hidden
                    />
                  )}
                  {isSoldOut && (
                    <Lock
                      size={12}
                      className="text-[var(--text-muted)]"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="block text-xs text-[var(--text-secondary)]">
                  {isSoldOut
                    ? "Betelt"
                    : `${sector.available_seats} / ${sector.total_seats} szabad`}
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    "block text-sm font-semibold tabular-nums",
                    isSelected
                      ? "text-[var(--accent-gold)]"
                      : "text-[var(--text-primary)]",
                  )}
                >
                  {formatPrice(Number(sector.price))}
                </span>
                <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  / jegy
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
