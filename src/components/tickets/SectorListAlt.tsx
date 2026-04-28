"use client";

import { Check, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { FIXED_SECTORS, type SectorName } from "@/lib/constants/sectors";
import type { SectorWithAvailability } from "@/lib/tickets-api";

interface SectorListAltProps {
  sectors: SectorWithAvailability[];
  selectedSectorId: string | null;
  onSelect: (sectorId: string) => void;
  className?: string;
}

/**
 * F20.5 — Fixed four-sector list (mobile fallback / list-view).
 *
 * Always renders the four canonical sectors in the {@link FIXED_SECTORS}
 * order — even ones missing from the API response (which surface as
 * "Hamarosan" inactive cards). This guarantees the list and the SVG map
 * stay structurally aligned: the user always sees the same four blocks
 * regardless of admin / seed state.
 *
 * Each card renders a name (Bebas Neue), capacity progress bar, price
 * and a status pill. Sold-out / missing cards are non-interactive and
 * cannot take focus or call `onSelect`.
 */
export function SectorListAlt({
  sectors,
  selectedSectorId,
  onSelect,
  className,
}: SectorListAltProps) {
  const byName = buildSlotMap(sectors);

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3",
        className,
      )}
    >
      {FIXED_SECTORS.map((spec) => {
        const sector = byName[spec.name];
        const isMissing = !sector;
        const isSoldOut = !!sector?.is_sold_out;
        const isSelected = !!sector && sector.id === selectedSectorId;
        const isInteractive = !isMissing && !isSoldOut;

        const total = sector?.total_seats ?? spec.defaultSeats;
        const sold = sector ? sector.total_seats - sector.available_seats : 0;
        const pct = total > 0 ? Math.min(100, (sold / total) * 100) : 0;

        return (
          <li key={spec.name}>
            <button
              type="button"
              onClick={() => {
                if (isInteractive && sector) onSelect(sector.id);
              }}
              disabled={!isInteractive}
              aria-pressed={isSelected}
              className={cn(
                "group flex w-full flex-col gap-3",
                "rounded-[var(--radius-md)] border px-4 py-3.5 text-left",
                "transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                isSelected
                  ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/10 shadow-[var(--shadow-glow-gold)]"
                  : isMissing || isSoldOut
                    ? "cursor-not-allowed border-dashed border-[var(--glass-border)] bg-transparent opacity-65"
                    : "border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
              )}
            >
              {/* Top row — name + status icon + price */}
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-display text-lg leading-none tracking-[0.08em]",
                        isSelected
                          ? "text-[var(--accent-gold)]"
                          : "text-[var(--text-primary)]",
                      )}
                    >
                      {spec.name}
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
                    {isMissing && (
                      <Clock
                        size={12}
                        className="text-[var(--text-muted)]"
                        aria-hidden
                      />
                    )}
                  </div>
                  <span className="block text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                    {isMissing
                      ? "Hamarosan"
                      : isSoldOut
                        ? "Betelt"
                        : `${sector!.available_seats} szabad / ${sector!.total_seats}`}
                  </span>
                </div>

                <div className="shrink-0 text-right">
                  <span
                    className={cn(
                      "block text-sm font-semibold tabular-nums",
                      isMissing
                        ? "text-[var(--text-muted)]"
                        : isSelected
                          ? "text-[var(--accent-gold)]"
                          : "text-[var(--text-primary)]",
                    )}
                  >
                    {formatPrice(Number(sector?.price ?? spec.defaultPrice))}
                  </span>
                  <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    / jegy
                  </span>
                </div>
              </div>

              {/* Capacity progress bar */}
              <div className="w-full">
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={sold}
                  aria-label={`${spec.name} kihasználtság`}
                  className={cn(
                    "relative h-1.5 w-full overflow-hidden rounded-full",
                    "bg-[var(--glass-bg-strong)]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
                      isSelected
                        ? "bg-[var(--accent-gold)]"
                        : isMissing
                          ? "bg-[var(--text-muted)]"
                          : isSoldOut
                            ? "bg-[var(--accent-red)]"
                            : "bg-[var(--accent-blue)]",
                    )}
                    style={{ width: isMissing ? "0%" : `${pct}%` }}
                  />
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function buildSlotMap(
  sectors: SectorWithAvailability[],
): Record<SectorName, SectorWithAvailability | undefined> {
  const map: Record<SectorName, SectorWithAvailability | undefined> = {
    TRIBUNA: undefined,
    LATERAL: undefined,
    "GOL NORD": undefined,
    "GOL SUD": undefined,
  };
  for (const sector of sectors) {
    const name = sector.sector_name as SectorName;
    if (name in map) map[name] = sector;
  }
  return map;
}
