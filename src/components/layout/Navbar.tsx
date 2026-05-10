"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
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

/**
 * Desktop pill-shaped sticky navbar.
 *
 * Layout: 3-section flex (logo / center links / icon cluster) inside a
 * rounded-full pill. Sits hidden on mobile (`md:flex`) — the mobile shell
 * uses `<MobileHeader />` and `<BottomTabBar />` instead.
 *
 * Visual state: always renders in the materialized glass-pill state
 * (border + translucent fill + backdrop blur + shadow). The previous
 * scroll-driven fade-in has been retired so the pill is recognisable
 * from the very top of every page.
 */
export function Navbar() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const { user } = useAuth();
  const { open: openSearch } = useSearchPalette();

  // Admin panel ships its own chrome (sidebar + topbar). Suppress the
  // public floating navbar entirely on /admin/* routes.
  if (pathname.startsWith("/admin")) return null;

  return (
    <motion.header
      initial={reduced ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="sticky top-4 z-50 hidden px-10 md:flex lg:px-14"
    >
      <nav
        aria-label="Főnavigáció"
        className={[
          // Pill geometry — container width unified with the rest of the
          // site at 1280px so the navbar lines up with hero/about/cta.
          "mx-auto flex w-full max-w-[1280px] items-center justify-between gap-6",
          "rounded-full px-6 py-2.5",
          // Glass: canonical `.glass-nav` utility — same recipe used by the
          // mobile header and bottom tab bar, so the floating frosted-glass
          // language is identical across surfaces.
          "glass-nav",
        ].join(" ")}
      >
        {/* ─────────────── LEFT: BRAND ─────────────── */}
        <Link
          href="/"
          className={[
            "group flex items-center gap-2.5",
            "transition-opacity duration-200 hover:opacity-90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] rounded-sm",
          ].join(" ")}
          aria-label="BARCAPULSE — főoldal"
        >
          <Image
            src="/images/logo/logo.png"
            alt="FC Barcelona"
            width={73}
            height={40}
            priority
            className="h-9 w-auto select-none"
          />
          <span
            className={[
              "font-display text-2xl tracking-wide",
              "text-[var(--accent-blue)] group-hover:text-[var(--accent-gold)]",
              "transition-colors duration-200",
            ].join(" ")}
          >
            BARCAPULSE
          </span>
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
