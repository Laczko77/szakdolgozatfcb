"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AdminButton } from "./AdminButton";
import { findActiveNavItem } from "./AdminSidebar";

interface AdminTopBarProps {
  onMenuClick: () => void;
}

/**
 * Sticky top bar for the admin shell.
 *
 * Shows: hamburger (mobile) · breadcrumb / current page · theme toggle ·
 * admin badge with user email · logout. Solid surface, hairline border.
 */
export function AdminTopBar({ onMenuClick }: AdminTopBarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const active = findActiveNavItem(pathname);

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 md:px-6"
      aria-label="Admin felső sáv"
    >
      <button
        onClick={onMenuClick}
        type="button"
        aria-label="Navigáció megnyitása"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <nav
        aria-label="Útvonal"
        className="flex flex-1 items-center gap-2 text-sm"
      >
        <Link
          href="/admin"
          className="font-display text-xs uppercase tracking-[0.16em] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        >
          Admin
        </Link>
        {active ? (
          <>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="font-display text-sm uppercase tracking-[0.08em] text-[var(--text-primary)]">
              {active.label}
            </span>
          </>
        ) : null}
      </nav>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {profile ? (
          <div
            className="hidden items-center gap-2 rounded-md border border-[var(--accent-gold)]/30 bg-[var(--accent-gold)]/10 px-3 py-1.5 sm:inline-flex"
            title={profile.email}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-gold)]" />
            <span className="max-w-[140px] truncate text-xs font-medium text-[var(--accent-gold)]">
              {profile.username ?? profile.email}
            </span>
          </div>
        ) : null}
        <AdminButton
          variant="subtle"
          size="sm"
          onClick={() => void signOut()}
          aria-label="Kijelentkezés"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Kilépés</span>
        </AdminButton>
      </div>
    </header>
  );
}
