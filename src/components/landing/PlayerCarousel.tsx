"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * PlayerCarousel — pinned ScrollTrigger section, editorial magazine layout.
 *
 * Visual model (post-redesign):
 *   - Full-bleed sharp player photo as the section background (no backdrop blur).
 *   - A slim white-bordered portrait frame anchored centre stage, holding the
 *     same photo cropped tighter to the player's face.
 *   - Four typographic anchors arranged at the corners of the stage like a
 *     magazine spread: numeric index (top-left), position (bottom-left),
 *     name + shirt number (top-right), season stats (bottom-right).
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
    image: "/images/players/raphina.jpg",
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
   Desktop: pinned + scrub + editorial composition
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
  const indexLabel = String(activeIndex + 1).padStart(2, "0");
  const totalLabel = String(players.length).padStart(2, "0");

  return (
    <div
      ref={containerRef}
      className="relative hidden h-screen w-full overflow-hidden md:block"
      aria-hidden={false}
    >
      {/* Background image — sharp, no blur. AnimatePresence cross-fades. */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={`bg-${active.name}`}
          initial={reduced ? false : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={active.image}
            alt=""
            fill
            sizes="100vw"
            priority={activeIndex === 0}
            className="object-cover object-top"
          />
          {/* Editorial overlay: just enough darkening for legibility. NO blur. */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,14,26,0.55) 0%, rgba(10,14,26,0.25) 35%, rgba(10,14,26,0.55) 100%)",
            }}
          />
          {/* Side vignette — guides the eye to the centre frame */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)",
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Top + bottom fades into bg-primary */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
        style={{
          background:
            "linear-gradient(to bottom, var(--bg-primary), rgba(0,0,0,0))",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24"
        style={{
          background:
            "linear-gradient(to top, var(--bg-primary), rgba(0,0,0,0))",
        }}
      />

      {/* Editorial stage */}
      <div className="relative z-20 mx-auto flex h-full max-w-[1400px] flex-col px-12 py-24 lg:px-20">
        {/* ── TOP ROW: index left, name right ─────────────────────────── */}
        <div className="flex items-start justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={`idx-${active.name}`}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center gap-4"
            >
              <span
                className="font-display text-5xl leading-none lg:text-6xl"
                style={{ color: "var(--accent-gold)" }}
              >
                {indexLabel}
              </span>
              <span className="block h-px w-16 bg-white/40" />
              <span className="text-xs uppercase tracking-[0.4em] text-white/60">
                / {totalLabel}
              </span>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`name-${active.name}`}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-end gap-2 text-right"
            >
              <span className="text-xs uppercase tracking-[0.4em] text-white/60">
                Szezon · 25/26
              </span>
              <h3 className="font-display text-4xl leading-[0.95] text-white lg:text-5xl xl:text-6xl">
                {active.name.toUpperCase()}
              </h3>
              <span
                className="font-display text-2xl leading-none lg:text-3xl"
                style={{ color: "var(--accent-gold)" }}
              >
                #{active.number}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── CENTRE FRAME ────────────────────────────────────────────── */}
        <div className="relative flex flex-1 items-center justify-center">
          <AnimatePresence mode="wait">
            <PortraitFrame
              key={`frame-${active.name}`}
              player={active}
              reduced={reduced}
            />
          </AnimatePresence>
        </div>

        {/* ── BOTTOM ROW: position left, stats right ──────────────────── */}
        <div className="flex items-end justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={`pos-${active.name}`}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-3"
            >
              <span className="text-xs uppercase tracking-[0.4em] text-white/60">
                Pozíció
              </span>
              <div className="flex items-center gap-4">
                <span className="block h-px w-12 bg-white/40" />
                <span className="font-display text-2xl uppercase tracking-[0.15em] text-white lg:text-3xl">
                  {active.position}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={`stats-${active.name}`}
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-end gap-3"
            >
              <span className="text-xs uppercase tracking-[0.4em] text-white/60">
                Idény statisztika
              </span>
              <div className="flex items-stretch gap-3">
                <EditorialStat label="Gól" value={active.goals} accent />
                <EditorialStat label="Gólpassz" value={active.assists} />
                <EditorialStat label="Meccs" value={active.appearances} />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <ProgressDots count={players.length} active={activeIndex} />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Centre frame — slim white-bordered portrait insert
   ──────────────────────────────────────────────────────────────────────── */

function PortraitFrame({
  player,
  reduced,
}: {
  player: Player;
  reduced: boolean;
}) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -8 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
      style={{
        width: "clamp(260px, 26vw, 360px)",
        aspectRatio: "3 / 4",
      }}
    >
      {/* Outer hairline frame */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[2px]"
        style={{
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.5), 0 0 0 8px rgba(255,255,255,0.04)",
        }}
      />
      {/* Inner inset — creates the "matted print" look */}
      <div
        className="absolute overflow-hidden rounded-[1px]"
        style={{
          inset: "10px",
          background: "rgba(10,14,26,0.4)",
        }}
      >
        <Image
          src={player.image}
          alt={player.name}
          fill
          sizes="(min-width: 768px) 360px, 0px"
          className="object-cover object-top"
        />
        {/* Subtle inner gradient for depth */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%)",
          }}
        />
      </div>

      {/* Decorative corner ticks — magazine register marks */}
      <CornerTick className="-left-2 -top-2" rotate={0} />
      <CornerTick className="-right-2 -top-2" rotate={90} />
      <CornerTick className="-bottom-2 -left-2" rotate={270} />
      <CornerTick className="-bottom-2 -right-2" rotate={180} />

      {/* Caption strip below frame */}
      <div
        className="absolute -bottom-10 left-0 right-0 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-white/55"
      >
        <span>FCB · {String(player.number).padStart(2, "0")}</span>
        <span>{player.position}</span>
      </div>
    </motion.div>
  );
}

function CornerTick({
  className,
  rotate,
}: {
  className: string;
  rotate: number;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-3 w-3 ${className}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        borderLeft: "1px solid rgba(255,255,255,0.85)",
        borderTop: "1px solid rgba(255,255,255,0.85)",
      }}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Editorial stat tile (compact, hairline border)
   ──────────────────────────────────────────────────────────────────────── */

function EditorialStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className="flex min-w-[88px] flex-col items-end gap-1 px-4 py-3"
      style={{
        borderLeft: "1px solid rgba(255,255,255,0.25)",
      }}
    >
      <span
        className="font-display text-3xl leading-none lg:text-4xl"
        style={{
          color: accent ? "var(--accent-gold)" : "#ffffff",
        }}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-[0.3em] text-white/55">
        {label}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Mobile: vertical stack — sharp photo, no blur, with editorial index
   ──────────────────────────────────────────────────────────────────────── */

function MobileStack({ players }: { players: ReadonlyArray<Player> }) {
  return (
    <div className="flex w-full flex-col gap-12 px-4 py-16 md:hidden">
      <h2 className="font-display text-center text-4xl tracking-wide text-[var(--text-primary)]">
        A keret
      </h2>
      {players.map((player, i) => (
        <MobilePlayerCard
          key={player.name}
          player={player}
          index={i}
          total={players.length}
          priority={i === 0}
        />
      ))}
    </div>
  );
}

function MobilePlayerCard({
  player,
  index,
  total,
  priority,
}: {
  player: Player;
  index: number;
  total: number;
  priority: boolean;
}) {
  const indexLabel = String(index + 1).padStart(2, "0");
  const totalLabel = String(total).padStart(2, "0");

  return (
    <article className="relative overflow-hidden rounded-3xl">
      <div className="relative aspect-[4/5] w-full">
        <Image
          src={player.image}
          alt=""
          fill
          sizes="(min-width: 768px) 0px, 100vw"
          priority={priority}
          className="object-cover object-top"
        />
        {/* Sharp — no backdrop-filter blur. Just a tonal gradient. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,14,26,0.35) 0%, rgba(10,14,26,0.05) 35%, rgba(10,14,26,0.95) 100%)",
          }}
        />

        {/* Top-left index marker */}
        <div className="absolute left-5 top-5 flex items-center gap-3">
          <span
            className="font-display text-3xl leading-none"
            style={{ color: "var(--accent-gold)" }}
          >
            {indexLabel}
          </span>
          <span className="block h-px w-8 bg-white/50" />
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/65">
            / {totalLabel}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.35em] text-white/65">
                {player.position}
              </span>
              <h3 className="font-display text-3xl leading-tight text-white">
                {player.name.toUpperCase()}
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="flex flex-col items-center gap-1 py-2 text-center"
      style={{ borderTop: "1px solid rgba(255,255,255,0.2)" }}
    >
      <div className="font-display text-xl text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
        {label}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Progress dots — vertical scrub indicator
   ──────────────────────────────────────────────────────────────────────── */

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
