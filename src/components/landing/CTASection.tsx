"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const CYCLING_WORDS: ReadonlyArray<string> = [
  "közösségnek",
  "szenvedélynek",
  "történelemnek",
  "családnak",
];

const CYCLE_INTERVAL_MS = 2500;

/**
 * CTA section.
 *
 * "Légy része a {cycling word}" — the trailing word swaps every 2.5s with
 * an AnimatePresence cross-fade. The CTA button below it is the only entry
 * point to /belepes from the landing page.
 *
 * Reduced motion: the word still cycles (informational), but transitions
 * collapse to instant. Disabling the cycle entirely would silently strip
 * info from the page — worse for users than removing motion.
 */

export default function CTASection() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % CYCLING_WORDS.length);
    }, CYCLE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const word = CYCLING_WORDS[index];

  return (
    <section
      aria-label="Csatlakozz"
      className="relative mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-28 text-center md:py-40"
    >
      {/* Ambient red+blue halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 30% 30%, rgba(29,78,216,0.10) 0%, rgba(0,0,0,0) 70%), radial-gradient(60% 50% at 70% 70%, rgba(220,38,38,0.10) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(20px)",
        }}
      />

      <motion.span
        initial={reduced ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-1 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)] backdrop-blur"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]" />
        Csatlakozz
      </motion.span>

      <motion.h2
        initial={reduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="font-display text-4xl leading-[1.05] text-[var(--text-primary)] sm:text-5xl md:text-7xl"
      >
        Légy része a{" "}
        <span className="relative inline-block min-w-[6ch] text-left align-baseline">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={word}
              initial={reduced ? false : { y: 28, opacity: 0, filter: "blur(6px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : { y: -28, opacity: 0, filter: "blur(6px)" }
              }
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block"
              style={{ color: "var(--accent-gold)" }}
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.h2>

      <motion.p
        initial={reduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        className="mt-6 max-w-xl text-base text-[var(--text-secondary)] md:text-lg"
      >
        Regisztrálj percek alatt — szavazz, kommentelj, gyűjts pontot,
        légy részünk.
      </motion.p>

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.55, delay: 0.3, ease: "easeOut" }}
        className="mt-10"
      >
        <Link href="/belepes" className="glass-button-primary group">
          <span>Regisztrálj most</span>
          <ArrowRight
            size={16}
            strokeWidth={2.25}
            className="transition-transform duration-300 group-hover:translate-x-1"
          />
        </Link>
      </motion.div>
    </section>
  );
}
