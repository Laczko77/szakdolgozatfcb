"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * Round +/- pill stepper used on the product page and in the cart drawer.
 *
 * The display is a non-interactive number — we don't expose a free-text
 * input because typing arbitrary values bypasses our stock guards and the
 * +/- buttons are accessible enough.  Accessibility: explicit `aria-label`
 * on each control plus a `aria-live` region that announces the new value
 * so screen readers track the change.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  disabled = false,
  ariaLabel = "Mennyiség",
}: QuantityStepperProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));

  const dimensions =
    size === "sm" ? "h-8 [&_button]:h-8 [&_button]:w-8" : "h-11 [&_button]:h-11 [&_button]:w-11";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "backdrop-blur-md",
        dimensions,
        disabled && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={disabled || value <= min}
        aria-label="Csökkentés"
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-colors",
          "hover:bg-[var(--glass-bg-hover)]",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        <Minus size={size === "sm" ? 14 : 16} strokeWidth={2} />
      </button>
      <span
        aria-live="polite"
        className={cn(
          "min-w-[2ch] text-center font-display tracking-wider text-[var(--text-primary)]",
          size === "sm" ? "text-sm" : "text-base",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={disabled || value >= max}
        aria-label="Növelés"
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-colors",
          "hover:bg-[var(--glass-bg-hover)]",
          "disabled:cursor-not-allowed disabled:opacity-40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        <Plus size={size === "sm" ? 14 : 16} strokeWidth={2} />
      </button>
    </div>
  );
}
