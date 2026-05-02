"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const CYCLING_WORDS: ReadonlyArray<string> = [
  "közösségnek",
  "szenvedélynek",
  "történelemnek",
  "családnak",
];

const CYCLE_INTERVAL_MS = 2800;

/**
 * CTA section.
 *
 * "Légy része a {cycling word}" — the trailing word swaps every 2.8s.
 *
 * Width problem fix: we measure each word's pixel width using a hidden div,
 * then spring-animate the container to the new width. This prevents the
 * surrounding text from jumping when a longer/shorter word appears.
 *
 * Reduced motion: word cycles without transitions (informational, not stripped).
 */

export default function CTASection() {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState<string>("auto");
  const measureRef = useRef<HTMLDivElement>(null);

  // Cycle the word index
  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % CYCLING_WORDS.length);
    }, CYCLE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  // Measure the current word's pixel width, re-run on index change and resize
  useEffect(() => {
    const measure = () => {
      if (!measureRef.current) return;
      const spans = measureRef.current.children;
      if (spans.length > index) {
        const w = spans[index].getBoundingClientRect().width;
        if (w > 0) setContainerWidth(`${w}px`);
      }
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index]);

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

      {/*
        Hidden measurement div — renders all words at the exact same font
        size as the h2 word, so getBoundingClientRect gives accurate widths.
        position:absolute keeps it out of the normal flow.
      */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none absolute font-display text-4xl leading-[1.05] sm:text-5xl md:text-7xl"
        style={{ visibility: "hidden", whiteSpace: "nowrap", top: 0, left: 0 }}
      >
        {CYCLING_WORDS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <motion.h2
        initial={reduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="font-display text-4xl leading-[1.05] text-[var(--text-primary)] sm:text-5xl md:text-7xl"
      >
        {"Légy része a "}
        {/*
          Outer span: springs to the measured pixel width of the current word.
          Inner word: blurs in/out with a gentle y movement.
          Together they prevent layout reflow — the container width changes
          smoothly, so the surrounding text never jumps.
        */}
        <motion.span
          className="relative inline-block align-bottom"
          animate={{
            width: containerWidth,
            transition: {
              type: "spring",
              stiffness: 140,
              damping: 18,
              mass: 1.0,
            },
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={word}
              initial={reduced ? false : { y: 18, opacity: 0, filter: "blur(8px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={
                reduced
                  ? { opacity: 0 }
                  : { y: -18, opacity: 0, filter: "blur(8px)" }
              }
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block font-display"
              style={{ color: "var(--accent-gold)", whiteSpace: "nowrap" }}
            >
              {word}
            </motion.span>
          </AnimatePresence>
        </motion.span>
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
        <Link href="/register" className="glass-button-primary group">
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
