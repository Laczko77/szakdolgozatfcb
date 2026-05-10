"use client";

import { useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { Trophy, Newspaper, Medal } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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
      className="relative mx-auto flex w-full max-w-[1280px] flex-col items-center px-4 py-24 sm:px-6 lg:px-10 md:py-36"
    >
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
        {/* Eyebrow — canonical: font-display, 11px, 0.4em tracking, gold.
            A single decorative gold rule replaces the previous pill capsule
            so the editorial dark canvas isn't competing with extra chrome. */}
        <motion.span
          variants={slideUpVariants}
          className="mb-5 inline-flex items-center gap-3 font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]"
        >
          <span aria-hidden className="block h-px w-6 bg-[var(--accent-gold)]/60" />
          Rólunk
          <span aria-hidden className="block h-px w-6 bg-[var(--accent-gold)]/60" />
        </motion.span>

        {/*
          Lead paragraph — the h2 slides up as a whole, then the 3 accent
          words individually slide+blur in with sequential delays.
          The accent words start at opacity:0 so the sentence appears with
          gaps first, then the key words fill in one by one.
        */}
        <motion.h2
          variants={slideUpVariants}
          className="font-display max-w-3xl text-center text-3xl leading-[1.15] text-[var(--text-primary)] sm:text-4xl md:text-5xl"
        >
          {"A magyar culer-ek portálja, ahol a "}
          <AccentWord delay={1.0} reduced={reduced}>közösség</AccentWord>
          {", a "}
          <AccentWord delay={1.25} reduced={reduced}>szenvedély</AccentWord>
          {" és a "}
          <AccentWord delay={1.5} reduced={reduced} gradient>Barça</AccentWord>
          {" találkozik."}
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
 * Gold accent word — slides up from below and blurs in after a delay.
 * Fires the gold-glow CSS animation once it comes to rest.
 */
function AccentWord({
  children,
  delay,
  reduced,
  gradient = false,
}: {
  children: React.ReactNode;
  delay: number;
  reduced: boolean;
  gradient?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const gradientStyle = gradient
    ? {
        background: "linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-red) 100%)",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
      }
    : { color: "var(--accent-gold)" };

  return (
    <motion.span
      ref={ref}
      className="inline-block font-display"
      style={gradientStyle}
      initial={reduced ? false : { opacity: 0, y: 22, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ delay, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (!reduced && ref.current && !gradient) {
          ref.current.classList.add("gold-glow-active");
        }
      }}
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
