"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useSearchPalette } from "@/providers/SearchProvider";
import { CartIconButton } from "@/components/shop/CartIconButton";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Compact sticky top bar — mobile only (`flex md:hidden`).
 *
 * Mirrors the desktop navbar's brand on the left and a minimal action
 * cluster (search + theme toggle) on the right. Primary navigation lives
 * in the bottom tab bar; this header is intentionally lean.
 */
export function MobileHeader() {
  const pathname = usePathname();
  const { open: openSearch } = useSearchPalette();
  // Admin panel uses its own mobile chrome — suppress the public mobile header.
  if (pathname.startsWith("/admin")) return null;
  return (
    <header
      className={[
        "glass-nav",
        "sticky top-0 z-40",
        "flex md:hidden items-center justify-between",
        "px-4 py-3",
        "border-b border-[var(--glass-border)]",
      ].join(" ")}
    >
      <Link
        href="/"
        aria-label="BARCAPULSE — főoldal"
        className={[
          "font-display text-xl tracking-wide",
          "text-[var(--accent-blue)] hover:text-[var(--accent-gold)]",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] rounded-sm",
        ].join(" ")}
      >
        BARCAPULSE
      </Link>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Keresés"
          title="Keresés"
          onClick={openSearch}
          className={[
            "inline-flex h-9 w-9 items-center justify-center rounded-full",
            "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            "hover:bg-[var(--glass-bg-hover)] transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
          ].join(" ")}
        >
          <Search size={20} strokeWidth={1.75} />
        </button>

        <CartIconButton size={20} />

        <ThemeToggle size={20} />
      </div>
    </header>
  );
}
