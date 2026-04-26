"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrimaryAuthButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

/**
 * Primary submit button used by the login and register forms.
 *
 * Visual: blau→grana gradient fill with a faint gold inner-rim and a
 * gold halo on hover. The shimmer keyframe (`shine`) lives below — a
 * one-off reusable animation that runs only on hover so the button
 * never strobes at rest.
 *
 * Disabled / loading state:
 *   - Pointer events off, opacity 60%
 *   - Spinner replaces the leading slot
 */
export function PrimaryAuthButton({
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: PrimaryAuthButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "group/btn relative isolate inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden",
        "rounded-md font-display text-[15px] uppercase tracking-[0.18em] text-white",
        "transition-[transform,box-shadow,filter] duration-200 ease-out",
        "shadow-[0_8px_24px_-8px_rgba(29,78,216,0.55)]",
        "hover:-translate-y-[1px] hover:shadow-[0_10px_32px_-6px_rgba(220,38,38,0.55)]",
        "active:translate-y-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-transparent",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      {/* Gradient fill */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(120deg, #1d4ed8 0%, #6d28d9 45%, #dc2626 100%)",
        }}
      />
      {/* Inner gold rim */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgba(245,158,11,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      />
      {/* Hover shine sweep */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover/btn:translate-x-[400%] group-hover/btn:opacity-100"
      />

      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
