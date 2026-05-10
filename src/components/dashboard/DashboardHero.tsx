"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils";

interface DashboardHeroProps {
  profile: Profile | null;
  email: string | null;
}

/**
 * Personalised greeting at the top of the dashboard.
 *
 * - Picks a context-aware greeting verb based on the local hour
 *   ("Jó reggelt" / "Szia" / "Jó estét") so the page feels alive.
 * - Falls back to the email handle when the profile has no username
 *   yet (the trigger row may briefly be missing right after sign-up).
 * - Avatar: real image when available, otherwise a glass disc with the
 *   user initial in Bebas Neue. The disc has a subtle gold ring so the
 *   eye lands here first.
 */
export function DashboardHero({ profile, email }: DashboardHeroProps) {
  const displayName = pickDisplayName(profile, email);
  const greeting = pickGreeting();
  const initial = (displayName || "B").charAt(0).toUpperCase();
  const today = formatTodayHu();

  return (
    <motion.header
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "glass-card relative overflow-hidden",
        "flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-8",
      )}
    >
      {/* Decorative gradient halo behind the avatar — barely-there in dark,
          a touch warmer in light mode. Sits behind the gold ring. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -left-12 -top-16 h-56 w-56 rounded-full",
          "bg-[radial-gradient(closest-side,var(--accent-gold-subtle),transparent)]",
          "opacity-60",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-20 -bottom-24 h-72 w-72 rounded-full",
          "bg-[radial-gradient(closest-side,var(--accent-blue-subtle),transparent)]",
          "opacity-50",
        )}
      />

      {/* Avatar — relative so the gold ring stays anchored on resize. */}
      <div className="relative shrink-0">
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 -m-1 rounded-full",
            "bg-[conic-gradient(from_180deg,var(--accent-gold),var(--accent-red),var(--accent-blue),var(--accent-gold))]",
            "opacity-70 blur-[2px]",
          )}
        />
        <div
          className={cn(
            "relative h-16 w-16 overflow-hidden rounded-full sm:h-20 sm:w-20",
            "border border-[var(--glass-border-hover)] bg-[var(--bg-secondary)]",
          )}
        >
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span
              className={cn(
                "flex h-full w-full items-center justify-center",
                "font-display text-3xl tracking-wide text-[var(--text-primary)]",
                "sm:text-4xl",
              )}
            >
              {initial}
            </span>
          )}
        </div>
      </div>

      {/* Greeting copy */}
      <div className="relative min-w-0 flex-1">
        <p className="font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          {today}
        </p>
        <h1
          className={cn(
            "mt-1 font-display leading-none tracking-wide",
            "text-3xl text-[var(--text-primary)] sm:text-5xl",
          )}
        >
          {greeting},{" "}
          <span className="text-[var(--accent-gold)]">{displayName}</span>
          <span aria-hidden className="ml-1 inline-block">👋</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          Itt találod a meccs visszaszámlálót, a frissen érkezett híreket, a
          pontegyenleged és a rendeléseid állapotát — egy pillantásra.
        </p>
      </div>
    </motion.header>
  );
}

/** Prefer username, fall back to the email local-part, then a literal "Szurkoló". */
function pickDisplayName(profile: Profile | null, email: string | null): string {
  if (profile?.username && profile.username.trim().length > 0) {
    return profile.username.trim();
  }
  if (email && email.includes("@")) {
    return email.split("@")[0];
  }
  return "Szurkoló";
}

/** Greeting verb keyed off the local hour — keeps the dashboard feeling current. */
function pickGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return "Jó reggelt";
  if (h >= 11 && h < 18) return "Szia";
  if (h >= 18 && h < 23) return "Jó estét";
  return "Jó éjszakát";
}

/** Today's date in Hungarian, e.g. "2026. április 27., hétfő". */
function formatTodayHu(): string {
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}
