import type { Variants, Transition } from "framer-motion";

/**
 * Reusable Framer Motion variants for the FC Barcelona portal.
 *
 * Naming convention: each variant has a `hidden` (initial) and a `visible`
 * (animate / whileInView) state, so they can be composed with parent
 * `staggerContainer` orchestrators.
 */

const easeOut: Transition["ease"] = "easeOut";
const easeBarca: Transition["ease"] = [0.25, 0.46, 0.45, 0.94];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const slideUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeBarca },
  },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeBarca },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeOut },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

/**
 * Blur-text reveal — used for hero headings.
 * Pair with a per-word/per-letter split for the BlurText effect.
 */
export const blurText: Variants = {
  hidden: { filter: "blur(10px)", opacity: 0, y: 50 },
  visible: {
    filter: "blur(0px)",
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

/**
 * Toast slide-in from the top — used by the global toast system.
 */
export const toastSlide: Variants = {
  hidden: { opacity: 0, y: -24, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -16,
    scale: 0.98,
    transition: { duration: 0.25, ease: "easeIn" },
  },
};
