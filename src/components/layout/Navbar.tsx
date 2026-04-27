"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useAuth } from "@/providers/AuthProvider";
import { useSearchPalette } from "@/providers/SearchProvider";
import { UserMenu } from "@/components/auth/UserMenu";
import { CartIconButton } from "@/components/shop/CartIconButton";
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
  const { user } = useAuth();
  const { open: openSearch } = useSearchPalette();

  const scrolled = scrollY > SCROLL_MATERIALIZE_THRESHOLD;

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
            aria-label="Keresés (Ctrl+K)"
            title="Keresés (Ctrl+K)"
            onClick={openSearch}
            className={[
              "inline-flex items-center gap-1.5 rounded-full",
              "h-9 pl-2.5 pr-2",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "border border-transparent hover:border-[var(--glass-border)]",
              "hover:bg-[var(--glass-bg-hover)] transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
            ].join(" ")}
          >
            <Search size={18} strokeWidth={1.75} />
            <kbd
              className={[
                "hidden lg:inline-flex items-center gap-0.5",
                "rounded border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "px-1 py-0.5 font-display text-[9px] tracking-wider text-[var(--text-muted)]",
              ].join(" ")}
              aria-hidden
            >
              ⌘K
            </kbd>
          </button>

          <CartIconButton size={18} />

          <ThemeToggle size={18} />

          {user ? (
            <UserMenu />
          ) : (
            <Link
              href="/login"
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
