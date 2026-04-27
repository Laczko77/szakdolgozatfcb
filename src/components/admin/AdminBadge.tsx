import * as React from "react";
import { cn } from "@/lib/utils";

type AdminBadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "gold";

const TONE_STYLES: Record<AdminBadgeTone, string> = {
  neutral:
    "bg-[var(--glass-bg)] text-[var(--text-secondary)] border-[var(--glass-border)]",
  info: "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border-[var(--accent-blue)]/30",
  success:
    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 dark:text-emerald-400",
  warning:
    "bg-amber-500/15 text-amber-500 border-amber-500/30",
  danger:
    "bg-[var(--accent-red)]/15 text-[var(--accent-red)] border-[var(--accent-red)]/30",
  gold:
    "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] border-[var(--accent-gold)]/30",
};

interface AdminBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: AdminBadgeTone;
}

export function AdminBadge({
  tone = "neutral",
  className,
  ...props
}: AdminBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
        "text-[11px] font-semibold uppercase tracking-[0.08em]",
        TONE_STYLES[tone],
        className,
      )}
      {...props}
    />
  );
}
