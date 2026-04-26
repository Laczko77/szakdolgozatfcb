"use client";

import { motion, type Variants } from "framer-motion";
import { Trophy, Newspaper, Medal } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * About / "miénk a portál" section.
 *
 * Composition:
 *   - Lead paragraph with three highlighted words ("közösség", "szenvedély",
 *     "Barça") that gain a gold text-shadow once they enter the viewport.
 *   - Three feature cards in a 1/3 column grid (mobile/desktop).
 *
 * Animations: parent staggerContainer drives slideUp on each child once the
 * section enters the viewport. The accent words use the `gold-glow-active`
 * CSS animation triggered via Framer Motion's `onViewportEnter`.
 */

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.18, delayChildren: 0.1 },
  },
};

const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const FEATURES: ReadonlyArray<{
  icon: typeof Trophy;
  title: string;
  body: string;
  hue: "gold" | "blue" | "red";
}> = [
  {
    icon: Trophy,
    title: "Jegyek",
    body: "Legyél ott a Camp Nou-ban — minden hazai meccsre a legjobb áron.",
    hue: "gold",
  },
  {
    icon: Newspaper,
    title: "Hírek",
    body: "Naprakész Barça hírek, elemzések és pillanatok a magyar Barça-szempontból.",
    hue: "blue",
  },
  {
    icon: Medal,
    title: "Közösség",
    body: "Szavazz, gyűjts pontot, légy részünk — a magyar culer-ek otthona.",
    hue: "red",
  },
];

const HUE_TO_COLOR: Record<"gold" | "blue" | "red", string> = {
  gold: "var(--accent-gold)",
  blue: "var(--accent-blue)",
  red: "var(--accent-red)",
};

export default function AboutSection() {
  const reduced = useReducedMotion();

  return (
    <section
      aria-label="Rólunk"
      className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-24 md:py-36"
    >
      {/* Soft ambient halo behind the heading */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[480px] max-w-3xl"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 30%, rgba(245,158,11,0.08) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(40px)",
        }}
      />

      <motion.div
        initial={reduced ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, amount: 0.25 }}
        variants={containerVariants}
        className="flex w-full flex-col items-center"
      >
        {/* Eyebrow */}
        <motion.span
          variants={slideUpVariants}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-1 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-gold)]" />
          Rólunk
        </motion.span>

        {/* Lead paragraph */}
        <motion.h2
          variants={slideUpVariants}
          className="font-display max-w-3xl text-center text-3xl leading-[1.15] text-[var(--text-primary)] sm:text-4xl md:text-5xl"
        >
          A magyar culer-ek portálja, ahol a{" "}
          <AccentWord delay={400} reduced={reduced}>
            közösség
          </AccentWord>
          , a{" "}
          <AccentWord delay={700} reduced={reduced}>
            szenvedély
          </AccentWord>{" "}
          és a{" "}
          <AccentWord delay={1000} reduced={reduced}>
            Barça
          </AccentWord>{" "}
          találkozik.
        </motion.h2>

        <motion.p
          variants={slideUpVariants}
          className="mt-6 max-w-2xl text-center text-base text-[var(--text-secondary)] md:text-lg"
        >
          Hírek, jegyek, mérkőzés-előrejelzések és egy aktív, magyar nyelvű
          közösség egy helyen — mindez a Barça színeibe öltöztetve.
        </motion.p>

        {/* Feature grid */}
        <div className="mt-16 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} variants={slideUpVariants} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}

/**
 * AccentWord — a span that picks up the `gold-glow-active` class once it
 * enters the viewport, producing a delayed glow-in. We use motion's
 * onViewportEnter so the trigger is identical to the rest of the section.
 */
function AccentWord({
  children,
  delay,
  reduced,
}: {
  children: React.ReactNode;
  delay: number;
  reduced: boolean;
}) {
  return (
    <motion.span
      className="inline-block font-display"
      style={{ color: "var(--text-primary)" }}
      onViewportEnter={(entry) => {
        if (!entry || reduced) {
          // In reduced mode, snap to gold instantly without animation.
          (entry?.target as HTMLElement | undefined)?.classList.add(
            "text-[var(--accent-gold)]",
          );
          return;
        }
        const el = entry.target as HTMLElement;
        window.setTimeout(() => {
          el.classList.add("gold-glow-active");
        }, delay);
      }}
      viewport={{ once: true, amount: 0.6 }}
    >
      {children}
    </motion.span>
  );
}

function FeatureCard({
  feature,
  variants,
}: {
  feature: (typeof FEATURES)[number];
  variants: Variants;
}) {
  const Icon = feature.icon;
  const color = HUE_TO_COLOR[feature.hue];

  return (
    <motion.div
      variants={variants}
      className="glass-card glass-card-hover group relative flex flex-col gap-3 p-7"
    >
      {/* Per-card hue accent — top edge gradient */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
        }}
      />

      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
        style={{ color }}
      >
        <Icon size={22} strokeWidth={1.75} />
      </span>

      <h3 className="font-display text-2xl tracking-wide text-[var(--text-primary)]">
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        {feature.body}
      </p>
    </motion.div>
  );
}
