"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Massive "FC BARCELONA" gradient title.
 *
 * The gradient uses CSS `background-clip: text` (see `.barca-text` in
 * globals.css). On hover the gradient sweeps from blue → gold → red,
 * a subtle reveal of the club's three accent colors.
 *
 * Visually this acts as a divider — sits between the player carousel and
 * the CTA, swallowing horizontal space so the rhythm of the page breathes.
 */

export default function BarcaText() {
  const reduced = useReducedMotion();

  return (
    <section
      aria-label="FC Barcelona"
      className="relative mx-auto flex w-full max-w-7xl items-center justify-center overflow-hidden px-4 py-20 sm:px-6 lg:px-10 md:py-28"
    >
      {/* Decorative crest-like top rule */}
      <div className="absolute left-1/2 top-10 -translate-x-1/2">
        <span className="block h-px w-32 bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent" />
      </div>

      <motion.h2
        initial={reduced ? false : { opacity: 0, y: 24, letterSpacing: "0.05em" }}
        whileInView={{
          opacity: 1,
          y: 0,
          letterSpacing: "0em",
        }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="barca-text font-display select-none whitespace-nowrap text-center text-[18vw] leading-none tracking-tight md:text-[14vw] lg:text-[clamp(6rem,12vw,13rem)]"
        tabIndex={0}
      >
        FC BARCELONA
      </motion.h2>

      {/* Sub-rule */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <span className="block h-px w-32 bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent" />
      </div>
    </section>
  );
}
