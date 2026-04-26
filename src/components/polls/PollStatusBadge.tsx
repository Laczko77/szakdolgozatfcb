import { Activity, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PollStatusBadgeProps {
  isActive: boolean;
  className?: string;
}

/**
 * Small pill-shaped status indicator shown on every poll card.
 *
 * Active polls get a soft green pulse; resolved polls get a neutral
 * checkmark. We keep both visually quiet so the question itself stays
 * the dominant element.
 */
export function PollStatusBadge({
  isActive,
  className,
}: PollStatusBadgeProps) {
  if (isActive) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full",
          "border border-emerald-400/40 bg-emerald-400/10",
          "px-2.5 py-1 text-[10px] uppercase tracking-[0.24em]",
          "text-emerald-300",
          className,
        )}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <Activity size={10} aria-hidden />
        Aktív
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "px-2.5 py-1 text-[10px] uppercase tracking-[0.24em]",
        "text-[var(--text-muted)]",
        className,
      )}
    >
      <CheckCircle2 size={10} aria-hidden />
      Lezárva
    </span>
  );
}
