"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small shared primitives for the /season page sections.
 *
 * Kept in one file so a chart component only needs a single import to
 * cover its loading / error / retry states.
 */

interface ChartSkeletonProps {
  /** Approximate visual height — match the chart's render height to avoid CLS. */
  height?: number;
  /** Show a horizontal rules row above the bars (mimics a chart's axis). */
  withAxis?: boolean;
  className?: string;
}

/**
 * Glass placeholder used while a chart's data is loading. Renders three
 * `animate-pulse` strips so the skeleton suggests a chart silhouette
 * without needing a SVG mock.
 */
export function ChartSkeleton({
  height = 320,
  withAxis = true,
  className,
}: ChartSkeletonProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[var(--radius-md)]",
        "border border-dashed border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]",
        className,
      )}
      style={{ height }}
      aria-hidden
      role="status"
      aria-label="Diagram betöltése"
    >
      <div className="absolute inset-0 flex flex-col justify-end gap-3 p-6">
        {[0.4, 0.65, 0.85, 0.55, 0.7].map((scale, i) => (
          <div
            key={i}
            className="h-2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]"
            style={{ width: `${scale * 100}%` }}
          />
        ))}
      </div>
      {withAxis && (
        <div className="absolute inset-x-6 top-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
          <span className="h-2 w-16 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <span className="h-2 w-10 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        </div>
      )}
    </div>
  );
}

interface ErrorBlockProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Friendly inline error state with a retry button. Used by every chart
 * section so the failure mode is consistent across the page.
 */
export function ErrorBlock({ message, onRetry, className }: ErrorBlockProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-10 text-center",
        "rounded-[var(--radius-md)]",
        "border border-dashed border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]",
        className,
      )}
    >
      <AlertCircle
        size={24}
        aria-hidden
        className="text-[var(--accent-red)]"
      />
      <p className="max-w-md text-sm text-[var(--text-secondary)]">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "inline-flex items-center gap-2 rounded-full",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            "px-4 py-1.5 text-sm font-medium text-[var(--text-primary)]",
            "transition-colors duration-200",
            "hover:border-[var(--accent-gold)] hover:bg-[var(--glass-bg-hover)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
          )}
        >
          <RefreshCw size={14} aria-hidden />
          Újrapróbálás
        </button>
      )}
    </div>
  );
}

interface EmptyBlockProps {
  message: string;
  className?: string;
}

/** Used when the upstream returned 200 but no rows (e.g. season hasn't started). */
export function EmptyBlock({ message, className }: EmptyBlockProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center py-10 text-center",
        "rounded-[var(--radius-md)]",
        "border border-dashed border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]",
        className,
      )}
    >
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
    </div>
  );
}

interface CacheLabelProps {
  cachedAt: string | null | undefined;
  /** Surface a "frissítés folyamatban" label when the API returned `stale: true`. */
  stale?: boolean;
}

/**
 * Tiny cache-age indicator shown on the right side of each ChartShell header.
 * Mirrors the convention used by StandingsWidget — only shows when the row
 * is older than one hour, so it doesn't add noise on fresh refreshes.
 */
export function CacheLabel({ cachedAt, stale = false }: CacheLabelProps) {
  const label = formatCacheAge(cachedAt);
  if (!label && !stale) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border",
        "border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "px-2.5 py-1 text-[10px] uppercase tracking-[0.2em]",
        stale
          ? "text-[var(--accent-red)]"
          : "text-[var(--text-muted)]",
      )}
    >
      {stale ? "Elavult" : label}
    </span>
  );
}

function formatCacheAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const cachedAt = new Date(iso).getTime();
  if (Number.isNaN(cachedAt)) return null;
  const ageMs = Date.now() - cachedAt;
  const oneHour = 60 * 60 * 1000;
  if (ageMs < oneHour) return null;
  const hours = Math.floor(ageMs / oneHour);
  if (hours < 24) return `Frissítve ${hours} órája`;
  const days = Math.floor(hours / 24);
  return `Frissítve ${days} napja`;
}
