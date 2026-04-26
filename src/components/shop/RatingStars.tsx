"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** 0–5, fractional values are rendered as a clipped half-star. */
  value: number;
  /** Px size of each star. Default 14. */
  size?: number;
  /** Optional review count rendered after the stars. */
  count?: number;
  /** When true, rendering is interactive (selectable rating). */
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

/**
 * Compact star-rating display.
 *
 * Read-only mode: renders 5 stars where the proportional fill is achieved
 * by stacking a clipped gold star over a muted background star — keeps
 * fractional ratings (e.g. 4.3) visually honest without two-pass math.
 *
 * Interactive mode: 5 buttons, hovering/clicking sets the rating. Used by
 * the review modal.
 */
export function RatingStars({
  value,
  size = 14,
  count,
  interactive = false,
  onChange,
  className,
}: RatingStarsProps) {
  if (interactive) {
    return (
      <div
        role="radiogroup"
        aria-label="Értékelés"
        className={cn("flex items-center gap-1", className)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= Math.round(value);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === Math.round(value)}
              aria-label={`${n} csillag`}
              onClick={() => onChange?.(n)}
              className={cn(
                "rounded-md p-1 transition-transform duration-150",
                "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              )}
            >
              <Star
                size={size + 8}
                strokeWidth={1.5}
                className={cn(
                  filled
                    ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]"
                    : "fill-transparent text-[var(--text-muted)]",
                )}
              />
            </button>
          );
        })}
      </div>
    );
  }

  const clamped = Math.min(5, Math.max(0, value));
  const fillPercent = (clamped / 5) * 100;

  return (
    <div
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={`${clamped.toFixed(1)} / 5 csillag`}
    >
      <div className="relative inline-flex">
        {/* Background row — muted */}
        <div className="flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              size={size}
              strokeWidth={1.5}
              className="fill-transparent text-[var(--text-muted)]"
            />
          ))}
        </div>
        {/* Foreground row — gold, clipped to the rating */}
        <div
          className="absolute inset-0 flex overflow-hidden"
          style={{ width: `${fillPercent}%` }}
          aria-hidden
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              size={size}
              strokeWidth={1.5}
              className="shrink-0 fill-[var(--accent-gold)] text-[var(--accent-gold)]"
            />
          ))}
        </div>
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-[var(--text-secondary)]">({count})</span>
      )}
    </div>
  );
}
