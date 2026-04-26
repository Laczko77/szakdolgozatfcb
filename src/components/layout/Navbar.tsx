"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAuthUser } from "@/hooks/useAuthUser";
import { ThemeToggle } from "./ThemeToggle";
import {
  desktopNavLinks,
  isRouteActive,
} from "./navigation.config";

const SCROLL_MATERIALIZE_THRESHOLD = 20;

/**
 * Desktop pill-shaped sticky navbar.
 *
 * Layout: 3-section flex (logo / center links / icon cluster) inside a
 * rounded-full pill. Sits hidden on mobile (`md:flex`) — the mobile shell
 * uses `<MobileHeader />` and `<BottomTabBar />` instead.
 *
 * Scroll behaviour: at the top of the page the pill is almost transparent;
 * once the user scrolls > 20px it gains its full glass background and
 * border via the `.glass-nav` utility plus a `data-scrolled` attribute
 * which we use to drive a CSS transition on the wrapper.
 */
export function Navbar() {
  const pathname = usePathname();
  const scrollY = useScrollPosition();
  const reduced = useReducedMotion();
  const { user } = useAuthUser();

  const scrolled = scrollY > SCROLL_MATERIALIZE_THRESHOLD;

  const initials = useMemo(() => buildInitials(user?.email, user?.user_metadata), [user]);

  return (
    <motion.header
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="sticky top-4 z-50 hidden px-10 md:flex lg:px-14"
    >
      <nav
        data-scrolled={scrolled ? "true" : "false"}
        aria-label="Főnavigáció"
        className={[
          // Pill geometry
          "mx-auto flex w-full max-w-6xl items-center justify-between gap-6",
          "rounded-full px-6 py-2.5",
          // Glass: starts almost invisible, materializes on scroll.
          // We keep the backdrop-filter on (it's cheap and gives a subtle
          // refraction on top of any hero content) but ramp up opacity,
          // border, and shadow only once scrolled.
          "border border-transparent bg-transparent",
          "backdrop-blur-0 supports-[backdrop-filter]:backdrop-blur-0",
          "shadow-none transition-[background-color,border-color,backdrop-filter,box-shadow] duration-300 ease-out",
          // Materialized state via data-attribute selectors (keeps utility
          // class composition simple and avoids inline style juggling).
          "data-[scrolled=true]:border-[var(--glass-border)]",
          "data-[scrolled=true]:bg-[var(--glass-bg-strong)]",
          "data-[scrolled=true]:supports-[backdrop-filter]:backdrop-blur-xl",
          "data-[scrolled=true]:shadow-[var(--shadow-md)]",
        ].join(" ")}
      >
        {/* ─────────────── LEFT: BRAND ─────────────── */}
        <Link
          href="/"
          className={[
            "font-display text-2xl tracking-wide",
            "text-[var(--accent-blue)] hover:text-[var(--accent-gold)]",
            "transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] rounded-sm",
          ].join(" ")}
          aria-label="BARCAPULSE — főoldal"
        >
          BARCAPULSE
        </Link>

        {/* ─────────────── CENTER: NAV LINKS ─────────────── */}
        <ul className="flex items-center gap-7">
          {desktopNavLinks.map((link) => {
            const active = isRouteActive(link.href, pathname);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative text-sm transition-colors duration-200",
                    active
                      ? "font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  ].join(" ")}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="navbar-active-underline"
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 380, damping: 32 }
                      }
                      className="absolute -bottom-1.5 left-0 right-0 h-[2px] rounded-full bg-[var(--accent-gold)]"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* ─────────────── RIGHT: ACTIONS ─────────────── */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Keresés"
            title="Keresés"
            className={[
              "inline-flex h-9 w-9 items-center justify-center rounded-full",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--glass-bg-hover)] transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
            ].join(" ")}
            // F10 will wire this up to the global command palette.
            onClick={() => {
              /* placeholder — implemented in iteration F10 */
            }}
          >
            <Search size={18} strokeWidth={1.75} />
          </button>

          <ThemeToggle size={18} />

          {user ? (
            <Link
              href="/profil"
              aria-label="Profil"
              title="Profil"
              className={[
                "ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full",
                "bg-[var(--accent-blue)] text-white",
                "text-xs font-semibold tracking-wide",
                "transition-transform duration-200 hover:scale-105",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                "ring-1 ring-inset ring-white/10",
              ].join(" ")}
            >
              {initials}
            </Link>
          ) : (
            <Link
              href="/belepes"
              className={[
                "ml-2 inline-flex items-center justify-center rounded-full",
                "px-4 py-1.5 text-sm font-medium",
                "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "text-[var(--text-primary)]",
                "hover:border-[var(--accent-gold)] hover:bg-[var(--glass-bg-hover)]",
                "transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              ].join(" ")}
            >
              Belépés
            </Link>
          )}
        </div>
      </nav>
    </motion.header>
  );
}

/**
 * Builds a 1–2 character avatar label from the user's metadata or email.
 * Prefers `display_name` / `full_name`, falls back to the e-mail local-part.
 */
function buildInitials(
  email: string | null | undefined,
  metadata: Record<string, unknown> | undefined,
): string {
  const meta = metadata ?? {};
  const displayName =
    typeof meta.display_name === "string"
      ? meta.display_name
      : typeof meta.full_name === "string"
        ? meta.full_name
        : typeof meta.name === "string"
          ? meta.name
          : null;

  const source = displayName?.trim() || email?.split("@")[0] || "";
  if (!source) return "?";

  const parts = source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return source.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
