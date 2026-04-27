"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { isRouteActive, mobileTabs } from "./navigation.config";

/**
 * Fixed bottom tab bar — mobile only (`flex md:hidden`).
 *
 * Five evenly-spaced tabs, each ~56px tall plus iOS safe-area padding.
 * Uses the `.glass-nav` utility for the materialized blur background and
 * a top border to separate it from page content. Active tab is highlighted
 * with the project's signature gold accent and a small pill indicator
 * behind the icon (animated with `layoutId`).
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  // Admin panel uses its own mobile nav — suppress the public bottom tab bar.
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      aria-label="Mobil navigáció"
      className={[
        "glass-nav",
        "fixed bottom-0 left-0 right-0 z-50",
        "flex md:hidden",
        "border-t border-[var(--glass-border)]",
        // iOS home-bar inset
        "pb-[env(safe-area-inset-bottom)]",
      ].join(" ")}
    >
      <ul className="flex w-full items-stretch justify-between px-1">
        {mobileTabs.map((tab) => {
          const Icon = tab.icon;
          const active = isRouteActive(tab.href, pathname);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                className={[
                  "relative flex h-16 flex-col items-center justify-center gap-1",
                  "transition-colors duration-200",
                  active
                    ? "text-[var(--accent-gold)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-inset",
                ].join(" ")}
              >
                {active && (
                  <motion.span
                    layoutId="bottom-tab-indicator"
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 380, damping: 30 }
                    }
                    className={[
                      "absolute top-1.5 h-1 w-8 rounded-full",
                      "bg-[var(--accent-gold)]",
                      "shadow-[var(--shadow-glow-gold)]",
                    ].join(" ")}
                    aria-hidden
                  />
                )}
                <Icon size={22} strokeWidth={active ? 2 : 1.75} />
                <span className="text-[10px] font-medium leading-none tracking-wide">
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
