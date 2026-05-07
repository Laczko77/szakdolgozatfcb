"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface LoadingScreenProps {
  /** Controls overlay visibility. When false, the screen unmounts. */
  isVisible: boolean;
  /** Optional supporting line under the crest. */
  label?: string;
}

/**
 * Full-screen, theme-aware loading overlay.
 * The Barça crest pulses (opacity + faint scale breathing) on a glassy backdrop.
 * Respects prefers-reduced-motion: pulse becomes a static, slightly translucent crest.
 */
export function LoadingScreen({
  isVisible,
  label = "Betöltés...",
}: LoadingScreenProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {isVisible ? (
        <motion.div
          key="loading-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-bg-primary"
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          {/* Soft radial glow behind the crest */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--shadow-glow-gold), transparent 60%)",
              opacity: 0.35,
            }}
          />

          <div className="relative flex flex-col items-center gap-6">
            <motion.div
              animate={
                reduce
                  ? { opacity: 0.85 }
                  : { opacity: [0.45, 1, 0.45], scale: [0.98, 1.02, 0.98] }
              }
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }
              className="drop-shadow-[0_0_24px_rgba(245,158,11,0.35)]"
            >
              <Image
                src="/images/logo/logo.png"
                alt="FC Barcelona logó"
                width={160}
                height={160}
                priority
                className="h-32 w-auto md:h-40"
              />
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="font-display text-text-secondary text-sm uppercase tracking-[0.32em]"
            >
              {label}
            </motion.p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
