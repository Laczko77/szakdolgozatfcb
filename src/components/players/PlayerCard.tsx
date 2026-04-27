"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import type { Player } from "@/types/database";
import { cn } from "@/lib/utils";
import { isPlayerPosition } from "@/lib/constants";
import {
  PLAYER_POSITION_LABELS,
  PLAYER_POSITION_SHORT,
} from "@/lib/player-positions";
import { readPlayerStats } from "@/lib/players-api";

interface PlayerCardProps {
  player: Player;
  /** Index in the staggered list — controls Framer Motion enter delay. */
  index?: number;
  /** Eager-load the first row of images on the listing page. */
  priority?: boolean;
}

/**
 * Flip card — keret listában használt játékos kártya.
 *
 * Front: jersey number jumbo, fotó, név, pozíció badge.
 * Back (only on `(hover: hover)` devices): 4 fő statisztika rács
 *      + "Profil megtekintése" CTA.
 *
 * The flip is pure CSS (`transform: rotateY(180deg)` + `backface-visibility`)
 * gated behind `@media (hover: hover) and (pointer: fine)`. Touch devices
 * therefore never see the back face — they tap once and navigate. This
 * keeps iOS Safari from "sticking" on a hovered/back state after tap.
 *
 * The whole card is wrapped in a single <Link>, so the card is one
 * focusable thing. The "Profil megtekintése" pill on the back is purely
 * decorative — a visual signal that the card is a destination.
 */
export function PlayerCard({ player, index = 0, priority = false }: PlayerCardProps) {
  const stats = readPlayerStats(player.stats);
  const positionLabel =
    player.position && isPlayerPosition(player.position)
      ? PLAYER_POSITION_LABELS[player.position]
      : (player.position ?? "");
  const positionShort =
    player.position && isPlayerPosition(player.position)
      ? PLAYER_POSITION_SHORT[player.position]
      : "";

  return (
    <motion.li
      variants={cardVariants}
      custom={index}
      className="player-card-perspective list-none"
      style={{ "--card-stagger": `${Math.min(index * 50, 400)}ms` } as React.CSSProperties}
    >
      <Link
        href={`/jatekosok/${player.id}`}
        aria-label={`${player.name} profilja`}
        className={cn(
          "player-card group relative block aspect-[3/4] w-full",
          "rounded-2xl outline-none",
          "focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
        )}
      >
        <div className="player-card-inner">
          {/* ──────────── FRONT ──────────── */}
          <div className="player-card-face player-card-front overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] backdrop-blur-md shadow-[var(--shadow-md)]">
            {/* Photo layer */}
            <div className="absolute inset-0">
              {player.image_url ? (
                <Image
                  src={player.image_url}
                  alt=""
                  fill
                  priority={priority}
                  sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
                  className="object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[var(--bg-secondary)]">
                  <span className="font-display text-7xl tracking-widest text-[var(--accent-gold)] opacity-30">
                    FCB
                  </span>
                </div>
              )}
            </div>

            {/* Stripe — diagonal accent band, blaugrana red→blue */}
            <div
              aria-hidden
              className="absolute -left-8 top-8 h-2 w-40 rotate-[-18deg]"
              style={{
                background:
                  "linear-gradient(90deg, var(--accent-red), var(--accent-blue))",
                opacity: 0.85,
              }}
            />

            {/* Bottom gradient veil for legibility */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/0"
            />

            {/* Position pill — top-right */}
            {positionLabel && (
              <span
                className={cn(
                  "absolute right-3 top-3 z-10",
                  "rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em]",
                  "border border-[var(--glass-border-hover)] bg-black/40 backdrop-blur-md",
                  "text-white",
                )}
                aria-label={`Pozíció: ${positionLabel}`}
              >
                <span className="hidden sm:inline">{positionLabel}</span>
                <span className="sm:hidden">{positionShort || positionLabel}</span>
              </span>
            )}

            {/* Jumbo jersey number — bleeds off the edge */}
            {player.number !== null && (
              <span
                aria-hidden
                className="pointer-events-none absolute -right-2 top-2 select-none font-display leading-none"
                style={{
                  color: "var(--accent-gold)",
                  fontSize: "clamp(5rem, 18vw, 9rem)",
                  textShadow: "0 0 28px rgba(196,163,77,0.35)",
                  opacity: 0.92,
                }}
              >
                {player.number}
              </span>
            )}

            {/* Name + mini stats footer */}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="font-display text-2xl leading-tight tracking-wide text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                {player.name}
              </h3>

              {/* Mobile-only mini stats — backlog F7.2: "Mobil: nincs flip
                  […] alul 2-3 fő stat szám".  Hidden on (hover: hover)
                  desktops because there the stats live on the back face. */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 player-card-mobile-stats">
                <MiniStat label="Gól" value={stats.goals ?? 0} />
                <MiniStat label="Assist" value={stats.assists ?? 0} />
                <MiniStat label="Meccs" value={stats.appearances ?? 0} />
              </div>
            </div>
          </div>

          {/* ──────────── BACK (hover-only) ──────────── */}
          <div className="player-card-face player-card-back overflow-hidden rounded-2xl border border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] backdrop-blur-md p-6 shadow-[var(--shadow-glow-gold)]">
            {/* Subtle radial accent */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 20% 0%, rgba(196,163,77,0.18), transparent 60%), radial-gradient(circle at 100% 100%, rgba(0,77,152,0.22), transparent 55%)",
              }}
            />

            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
                    Statisztikák
                  </p>
                  <h3 className="mt-1 font-display text-xl leading-tight text-[var(--text-primary)] truncate">
                    {player.name}
                  </h3>
                </div>
                {player.number !== null && (
                  <span
                    aria-hidden
                    className="font-display text-3xl leading-none"
                    style={{ color: "var(--accent-gold)" }}
                  >
                    {player.number}
                  </span>
                )}
              </div>

              <ul className="mt-5 grid grid-cols-2 gap-2 text-[var(--text-primary)]">
                <BackStat label="Gól" value={stats.goals ?? 0} />
                <BackStat label="Gólpassz" value={stats.assists ?? 0} />
                <BackStat label="Meccs" value={stats.appearances ?? 0} />
                <BackStat
                  label="Sárga"
                  value={stats.yellow_cards ?? 0}
                  accentClass="border-[#facc15]/40"
                />
              </ul>

              <div className="mt-auto pt-4">
                <span
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2",
                    "rounded-full border border-[var(--accent-gold)] bg-[var(--glass-bg)]",
                    "px-4 py-2 text-xs font-medium uppercase tracking-[0.2em]",
                    "text-[var(--accent-gold)]",
                  )}
                >
                  Profil megtekintése
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  >
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

/* ---------- sub components ---------- */

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-center backdrop-blur-sm">
      <div className="font-display text-base leading-none text-white tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-widest text-white/70">
        {label}
      </div>
    </div>
  );
}

function BackStat({
  label,
  value,
  accentClass,
}: {
  label: string;
  value: number;
  accentClass?: string;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border bg-[var(--glass-bg)] px-3 py-2.5",
        accentClass ?? "border-[var(--glass-border)]",
      )}
    >
      <div className="font-display text-xl leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </div>
    </li>
  );
}

/* ---------- Framer Motion variants ---------- */

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      delay: Math.min(i * 0.04, 0.4),
    },
  }),
};
