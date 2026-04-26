"use client";

import { Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface ThemeToggleProps {
  /** Icon size in pixels — defaults to 18 (Navbar). Mobile header may pass 20. */
  size?: number;
  className?: string;
}

/**
 * Sun ⇄ Moon theme toggle. Keeps the toggle visually centred while the icon
 * inside rotates and cross-fades on theme change.
 *
 * Animation: 0.4s rotate + opacity. Disabled when prefers-reduced-motion.
 */
export function ThemeToggle({ size = 18, className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const reduced = useReducedMotion();
  const isDark = theme === "dark";

  const transition = reduced
    ? { duration: 0 }
    : { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        isDark ? "Váltás világos témára" : "Váltás sötét témára"
      }
      title={isDark ? "Világos téma" : "Sötét téma"}
      className={[
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full",
        "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
        "hover:bg-[var(--glass-bg-hover)] transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-0",
        className,
      ].join(" ")}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={transition}
            className="inline-flex"
          >
            <Moon size={size} strokeWidth={1.75} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={transition}
            className="inline-flex"
          >
            <Sun size={size} strokeWidth={1.75} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
