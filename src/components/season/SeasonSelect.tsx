"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SeasonOption {
  /** `season` query param value — football-data.org's "start year" convention. */
  value: number;
  /** Human label, e.g. "2025/26". */
  label: string;
}

interface SeasonSelectProps {
  value: number;
  options: ReadonlyArray<SeasonOption>;
  onChange: (next: number) => void;
  className?: string;
}

/**
 * Glass dropdown for picking the season displayed across the /season page.
 *
 * Implementation notes:
 *  - Hand-rolled (instead of Radix) so the surface uses the project's
 *    `glass-modal`-friendly tokens directly and matches the rest of the
 *    /season chrome.
 *  - Click-outside via `pointerdown` so the closing race with focus
 *    transitions is avoided.
 *  - Keyboard: Enter/Space toggles, Escape closes, ArrowDown opens.
 */
export function SeasonSelect({
  value,
  options,
  onChange,
  className,
}: SeasonSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: PointerEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", handle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", handle);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = options.find((o) => o.value === value);

  return (
    <div
      ref={wrapperRef}
      className={cn("relative inline-block", className)}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)]",
          "px-4 py-2 text-sm font-medium text-[var(--text-primary)]",
          "shadow-[var(--shadow-md)] backdrop-blur-md",
          "transition-colors duration-200",
          "hover:border-[var(--accent-gold)] hover:bg-[var(--glass-bg-hover)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        <Calendar
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className="text-[var(--accent-gold)]"
        />
        <span>{active?.label ?? "—"}</span>
        <ChevronDown
          size={14}
          strokeWidth={2}
          aria-hidden
          className={cn(
            "transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Szezon kiválasztása"
          className={cn(
            "absolute right-0 top-full z-30 mt-2 min-w-[10rem] overflow-hidden",
            "rounded-2xl border border-[var(--glass-border)]",
            "bg-[var(--glass-bg-strong)] shadow-[var(--shadow-md)]",
            "backdrop-blur-xl",
          )}
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 px-4 py-2 text-sm",
                    "transition-colors duration-150",
                    selected
                      ? "bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]"
                      : "text-[var(--text-primary)] hover:bg-[var(--glass-bg-hover)]",
                    "focus-visible:outline-none focus-visible:bg-[var(--glass-bg-hover)]",
                  )}
                >
                  <span className="font-medium">{opt.label}</span>
                  {selected && (
                    <span
                      aria-hidden
                      className="font-display text-[10px] uppercase tracking-[0.2em] text-[var(--accent-gold)]"
                    >
                      ●
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type { SeasonOption };
