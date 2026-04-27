"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * PlayerCarousel — pinned ScrollTrigger section.
 *
 * Desktop: the section is pinned at top:top and the user "scrolls" through
 * N players. Each scroll progress segment swaps the active player via React
 * state (Framer AnimatePresence handles the cross-fade).
 *
 * Mobile / touch / reduced-motion: stacks the players vertically with no
 * pinning. We never even register ScrollTrigger in those cases, which keeps
 * the scroll behavior native and avoids iOS Safari's pin quirks.
 *
 * Data: F7.5 wired this up to live data. The page.tsx server component
 * fetches the top 3 players and passes them as `players`. If the DB is
 * empty (fresh install, before the admin sync runs) we fall back to the
 * hardcoded set so the landing page still has something to show.
 */

interface Player {
  name: string;
  number: number;
  position: string;
  goals: number;
  assists: number;
  appearances: number;
  image: string;
}

const HARDCODED_PLAYERS: ReadonlyArray<Player> = [
  {
    name: "Robert Lewandowski",
    number: 9,
    position: "Csatár",
    goals: 27,
    assists: 8,
    appearances: 34,
    image: "/images/players/lewandowski.jpg",
  },
  {
    name: "Pedri",
    number: 8,
    position: "Középpályás",
    goals: 8,
    assists: 11,
    appearances: 29,
    image: "/images/players/pedri.jpg",
  },
  {
    name: "Raphinha",
    number: 11,
    position: "Szélső",
    goals: 21,
    assists: 16,
    appearances: 37,
    image: "/images/players/raphinha.jpg",
  },
];

// Register ScrollTrigger plugin once on the client.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export interface PlayerCarouselProps {
  /**
   * Optional live data. When omitted (or shorter than 2 entries), the
   * component falls back to the hardcoded set so the carousel still
   * renders something on a fresh install.
   */
  players?: ReadonlyArray<Player>;
}

export default function PlayerCarousel({ players }: PlayerCarouselProps = {}) {
  const reduced = useReducedMotion();

  // Require at least two players for the pinned scroll to make sense —
  // anything less and we use the canonical hardcoded fallback.
  const data = players && players.length >= 2 ? players : HARDCODED_PLAYERS;

  // We don't bother feature-detecting here at the React level — we
  // delegate it to ScrollTrigger.isTouch() inside useGSAP so the SSR-safe
  // markup is always identical.
  return (
    <section
      aria-label="A keret"
      className="relative w-full"
    >
      <DesktopPinned reduced={reduced} players={data} />
      <MobileStack players={data} />
    </section>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Desktop: pinned + scrub
   ──────────────────────────────────────────────────────────────────────── */

function DesktopPinned({
  reduced,
  players,
}: {
  reduced: boolean;
  players: ReadonlyArray<Player>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useGSAP(
    () => {
      if (reduced) return;
      // ScrollTrigger.isTouch returns 1/2 on touch devices — we skip pinning
      // on those entirely.
      if (ScrollTrigger.isTouch) return;

      const trigger = ScrollTrigger.create({
        trigger: containerRef.current,
        pin: true,
        start: "top top",
        end: `+=${players.length * 100}%`,
        scrub: 1,
        anticipatePin: 1,
        onUpdate: (self) => {
          const idx = Math.min(
            players.length - 1,
            Math.floor(self.progress * players.length),
          );
          setActiveIndex((prev) => (prev === idx ? prev : idx));
        },
      });

      return () => trigger.kill();
    },
    { scope: containerRef, dependencies: [reduced, players.length] },
  );

  const active = players[activeIndex];

  return (
    <div
      ref={containerRef}
      className="relative hidden h-screen w-full overflow-hidden md:block"
      aria-hidden={false}
    >
      {/* Background image — cross-fades between players */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={`bg-${active.name}`}
          initial={reduced ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={active.image}
            alt=""
            fill
            sizes="100vw"
            priority={activeIndex === 0}
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              background:
                "linear-gradient(180deg, rgba(10,14,26,0.55) 0%, rgba(10,14,26,0.85) 100%)",
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Top + bottom fades into bg-primary */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32"
        style={{
          background:
            "linear-gradient(to bottom, var(--bg-primary), rgba(0,0,0,0))",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32"
        style={{
          background: "linear-gradient(to top, var(--bg-primary), rgba(0,0,0,0))",
        }}
      />

      {/* Foreground card */}
      <div className="relative z-20 mx-auto flex h-full max-w-6xl items-center px-6">
        <AnimatePresence mode="wait">
          <PlayerCard key={active.name} player={active} reduced={reduced} />
        </AnimatePresence>

        <ProgressDots
          count={players.length}
          active={activeIndex}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Mobile: vertical stack
   ──────────────────────────────────────────────────────────────────────── */

function MobileStack({ players }: { players: ReadonlyArray<Player> }) {
  return (
    <div className="flex w-full flex-col gap-12 px-4 py-16 md:hidden">
      <h2 className="font-display text-center text-4xl tracking-wide text-[var(--text-primary)]">
        A keret
      </h2>
      {players.map((player, i) => (
        <MobilePlayerCard key={player.name} player={player} priority={i === 0} />
      ))}
    </div>
  );
}

function MobilePlayerCard({
  player,
  priority,
}: {
  player: Player;
  priority: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-3xl">
      <div className="relative aspect-[4/5] w-full">
        <Image
          src={player.image}
          alt=""
          fill
          sizes="(min-width: 768px) 0px, 100vw"
          priority={priority}
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,14,26,0.0) 30%, rgba(10,14,26,0.95) 100%)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] px-3 py-1 text-xs uppercase tracking-widest text-[var(--text-secondary)] backdrop-blur">
                {player.position}
              </span>
              <h3 className="font-display text-3xl leading-tight text-white">
                {player.name}
              </h3>
            </div>
            <span
              className="font-display text-6xl leading-none"
              style={{ color: "var(--accent-gold)" }}
            >
              {player.number}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat label="Gól" value={player.goals} />
            <MiniStat label="Gólpassz" value={player.assists} />
            <MiniStat label="Meccs" value={player.appearances} />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Shared sub-components
   ──────────────────────────────────────────────────────────────────────── */

function PlayerCard({
  player,
  reduced,
}: {
  player: Player;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -24 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card-strong w-full max-w-2xl rounded-3xl p-10"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
            {player.position}
          </span>
          <h3 className="font-display text-5xl leading-[1] text-[var(--text-primary)] md:text-6xl">
            {player.name}
          </h3>
        </div>
        <span
          aria-label={`Mezszám ${player.number}`}
          className="font-display leading-none"
          style={{
            color: "var(--accent-gold)",
            fontSize: "clamp(5rem, 9vw, 8rem)",
            textShadow: "0 0 40px rgba(245,158,11,0.35)",
          }}
        >
          {player.number}
        </span>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4">
        <Stat label="Gólok" value={player.goals} />
        <Stat label="Gólpasszok" value={player.assists} />
        <Stat label="Meccsek" value={player.appearances} />
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-5 backdrop-blur">
      <div className="font-display text-3xl text-[var(--text-primary)] md:text-4xl">
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-center backdrop-blur">
      <div className="font-display text-xl text-white">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-white/70">
        {label}
      </div>
    </div>
  );
}

function ProgressDots({ count, active }: { count: number; active: number }) {
  return (
    <ul
      aria-hidden
      className="absolute right-8 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-3"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="h-8 w-px overflow-hidden rounded-full bg-white/15"
        >
          <span
            className="block w-full origin-top transition-transform duration-500"
            style={{
              height: "100%",
              transform: i === active ? "scaleY(1)" : "scaleY(0)",
              background: "var(--accent-gold)",
            }}
          />
        </li>
      ))}
    </ul>
  );
}
