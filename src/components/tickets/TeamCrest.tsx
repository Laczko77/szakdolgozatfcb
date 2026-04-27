"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface TeamCrestProps {
  /** Crest URL from football-data.org (Match.home_team_crest / away_team_crest). */
  url: string | null;
  /** Team name — used for `alt` text and the initials fallback. */
  teamName: string;
  /** Pixel size of the (square) crest. Drives both `width`/`height` and the
   * Tailwind size class. Default: 40 (cards). Hero: 64-72. Widget: 32. */
  size?: number;
  /** Eager-load crest images that are above the fold. */
  priority?: boolean;
  className?: string;
}

/**
 * Square team crest — used wherever we render `home_team` / `away_team`
 * pairs (match cards, jegyek hero, dashboard NextMatch widget, profil
 * Jegyeim tab, MyTicketCard).
 *
 * F17 design contract:
 *  - Small subtle glass plate behind the crest so transparent PNGs read on
 *    both light and dark backgrounds.
 *  - `object-contain` (NEVER `cover`) — crests must not be cropped, even
 *    on club badges with extreme aspect ratios.
 *  - Initials fallback when the URL is null: gold-on-glass roundel that
 *    matches the rest of the design system rather than a generic icon.
 */
export function TeamCrest({
  url,
  teamName,
  size = 40,
  priority = false,
  className,
}: TeamCrestProps) {
  const initials = computeInitials(teamName);
  const dimension = `${size}px`;

  return (
    <span
      aria-hidden={!url}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        "rounded-full border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] backdrop-blur-sm",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04),inset_0_0_0_1px_rgba(255,255,255,0.03)]",
        className,
      )}
      style={{ width: dimension, height: dimension }}
    >
      {url ? (
        <Image
          src={url}
          alt={`${teamName} címer`}
          width={size}
          height={size}
          priority={priority}
          // football-data.org returns a heterogeneous mix of SVG and PNG —
          // unoptimized lets `next/image` pass them through verbatim, which
          // is fine for sub-100px logos.
          unoptimized
          className="h-[78%] w-[78%] object-contain"
        />
      ) : (
        <span
          className="font-display tracking-[0.05em] text-[var(--accent-gold)]"
          style={{ fontSize: `${Math.max(10, size * 0.32)}px` }}
        >
          {initials}
        </span>
      )}
    </span>
  );
}

/** "FC Barcelona" → "FCB", "Real Madrid" → "RM", "Athletic" → "AT". */
function computeInitials(name: string): string {
  const cleaned = name
    .replace(/\b(FC|CF|AC|UD|SD|RC|AD|CD)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length === 0) return "?";
  if (tokens.length === 1) {
    return tokens[0]!.slice(0, 3).toUpperCase();
  }
  return tokens
    .slice(0, 3)
    .map((t) => t[0]!.toUpperCase())
    .join("");
}
