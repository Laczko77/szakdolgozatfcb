"use client";

import { motion, type Variants } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Landing hero — full-viewport "WOW" entry.
 *
 * Layers (back-to-front):
 *   1. Camp Nou video on desktop (lazy, hidden < md)
 *   2. Static gradient fallback (always rendered, sits under the video)
 *   3. Black scrim @ 50%
 *   4. Top + bottom vertical fades that bleed into bg-primary so the
 *      hero seams seamlessly into the next section.
 *   5. Hero copy: blur-text headline word-by-word, fade-up tagline, CTA.
 *   6. Bouncing scroll indicator pinned to the bottom centre.
 */

const HEADLINE = "Més que un club";
const TAGLINE = "Több, mint egy klub. Több, mint egy portál.";

const wordVariants: Variants = {
  hidden: { filter: "blur(14px)", opacity: 0, y: 32 },
  visible: {
    filter: "blur(0px)",
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.16, delayChildren: 0.2 },
  },
};

const taglineVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut", delay: 0.9 },
  },
};

const ctaVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut", delay: 1.25 },
  },
};

export default function HeroSection() {
  const reduced = useReducedMotion();
  const words = HEADLINE.split(" ");

  const handleScrollDown = () => {
    if (typeof window === "undefined") return;
    window.scrollTo({
      top: window.innerHeight,
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <section
      aria-label="Bevezető"
      className="relative isolate flex min-h-[calc(100svh+3.5rem)] items-center justify-center overflow-hidden -mt-[3.5rem] md:-mt-[calc(1rem+4.5rem)] md:min-h-[calc(100svh+1rem+4.5rem)]"
    >
      {/* ────────── Background layers ────────── */}

      {/* Static fallback gradient — always rendered. Painted first, the video
          sits on top of it on desktop. On mobile this IS the background. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-30"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, rgba(29,78,216,0.18) 0%, rgba(0,0,0,0) 55%), radial-gradient(80% 60% at 80% 90%, rgba(220,38,38,0.18) 0%, rgba(0,0,0,0) 55%), var(--bg-primary)",
        }}
      />

      {/* Subtle drifting noise — adds organic film grain over the gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 opacity-[0.08] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.6'/></svg>\")",
          animation: reduced ? "none" : "drift 18s ease-in-out infinite",
        }}
      />

      {/* Desktop-only Camp Nou video. The <video> falls through to the static
          background gracefully if /videos/camp-nou.mp4 doesn't exist. */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
        className="absolute inset-0 -z-20 hidden h-full w-full object-cover md:block"
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      {/* Veo watermark cover — masks the AI-generator watermark in the
          bottom-right corner of /videos/hero.mp4. Sits above the video
          (-z-20) but below the black scrim (-z-10) so the scrim's tint
          and the bottom fade still flow over it seamlessly. Desktop-only,
          mirroring the <video> element's md+ visibility. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 z-[-15] hidden h-20 w-40 md:block"
        style={{
          background:
            "radial-gradient(ellipse at bottom right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.85) 45%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Black scrim — pulls the headline forward. */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-black/55" />

      {/* Bottom fade — subtle blend into the next section. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 md:h-32"
        style={{
          background:
            "linear-gradient(to top, color-mix(in srgb, var(--bg-primary) 70%, transparent) 0%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* ────────── Foreground content ────────── */}

      <motion.div
        initial={reduced ? false : "hidden"}
        animate="visible"
        variants={containerVariants}
        className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center px-4 text-center sm:px-6 lg:px-10"
      >
        <h1
          className="font-display text-[14vw] leading-[0.95] tracking-tight text-white sm:text-7xl md:text-8xl lg:text-[clamp(6rem,10vw,11rem)]"
          aria-label={HEADLINE}
        >
          {words.map((word, i) => (
            <motion.span
              key={`${word}-${i}`}
              variants={wordVariants}
              className="inline-block px-[0.06em]"
              aria-hidden
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          variants={taglineVariants}
          className="mt-6 max-w-xl text-base text-white/80 sm:text-lg md:text-xl"
        >
          {TAGLINE}
        </motion.p>

        <motion.div variants={ctaVariants} className="mt-10">
          <button
            type="button"
            onClick={handleScrollDown}
            className={`glass-button-primary cta-pulse ${
              reduced ? "[animation:none]" : ""
            }`}
            aria-label="Fedezd fel a portált — görgess lefelé"
          >
            <span>Fedezd fel</span>
            <ChevronDown size={16} strokeWidth={2.25} />
          </button>
        </motion.div>
      </motion.div>

      {/* ────────── Scroll indicator ────────── */}
      <button
        type="button"
        onClick={handleScrollDown}
        aria-label="Görgess lefelé"
        className={`absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] ${
          reduced ? "" : "scroll-indicator-bounce"
        }`}
      >
        <ChevronDown size={28} strokeWidth={1.5} />
      </button>
    </section>
  );
}
