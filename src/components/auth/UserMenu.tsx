"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Coins,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  /** Optional override class for the trigger avatar button. */
  className?: string;
}

/**
 * Avatar trigger + glassy dropdown menu — the navbar's signed-in slot.
 *
 * Built from primitives instead of Radix because:
 *   - We need full control over the glass styling and motion
 *   - The menu is small (~5 entries) and accessibility-wise an aria-menu
 *     with arrow-key support is overkill; a simple popover with focus
 *     management is enough
 *
 * Closes on:
 *   - Outside click
 *   - Escape key
 *   - Any internal navigation (Link click)
 */
export function UserMenu({ className }: UserMenuProps) {
  const { user, profile, isAdmin, signOut } = useAuth();
  const reduce = useReducedMotion();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const initials = useMemo(
    () =>
      buildInitials(
        profile?.username,
        user?.email ?? null,
        user?.user_metadata,
      ),
    [profile, user],
  );

  const displayName = useMemo(() => {
    if (profile?.username) return profile.username;
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    if (typeof meta?.full_name === "string") return meta.full_name;
    if (typeof meta?.name === "string") return meta.name;
    return user?.email?.split("@")[0] ?? "Szurkoló";
  }, [profile, user]);

  const avatarUrl = profile?.avatar_url ?? null;

  // ── Close on outside click ────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Felhasználói menü"
        className={cn(
          "ml-1 inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full",
          "ring-1 ring-inset ring-white/10",
          "transition-[transform,box-shadow] duration-200",
          "hover:scale-105",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
          // gradient background when no avatar
          !avatarUrl &&
            "bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-red)] text-white",
          open && "ring-2 ring-[var(--accent-gold)]",
        )}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-semibold tracking-wide">
            {initials}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            role="menu"
            aria-label="Fiók menü"
            className={cn(
              "absolute top-12 right-0 w-64 origin-top-right",
              "glass-card-strong glass-border-gradient",
              "p-2",
            )}
            style={{
              // Keep the menu on top of mobile bottom-bar etc.
              zIndex: 60,
            }}
          >
            {/* User identity card */}
            <div className="border-b border-[var(--glass-border)] px-3 py-3">
              <div className="text-text-primary truncate text-sm font-medium">
                {displayName}
              </div>
              <div className="text-text-muted truncate text-xs">
                {user.email}
              </div>
              {isAdmin && (
                <div
                  className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent-gold)]/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-gold)] ring-1 ring-[var(--accent-gold)]/30"
                  aria-label="Adminisztrátor"
                >
                  <Shield size={11} />
                  Admin
                </div>
              )}
            </div>

            {/* Menu items */}
            <ul className="py-1.5">
              <MenuItem
                href="/profil"
                icon={<UserIcon size={15} />}
                onSelect={() => setOpen(false)}
              >
                Profil
              </MenuItem>
              <MenuItem
                href="/dashboard"
                icon={<LayoutDashboard size={15} />}
                onSelect={() => setOpen(false)}
              >
                Vezérlőpult
              </MenuItem>
              <MenuItem
                href="/pontjaim"
                icon={<Coins size={15} />}
                onSelect={() => setOpen(false)}
              >
                Pontjaim
              </MenuItem>
              <MenuItem
                href="/profil?tab=settings"
                icon={<Settings size={15} />}
                onSelect={() => setOpen(false)}
              >
                Beállítások
              </MenuItem>
              {isAdmin && (
                <MenuItem
                  href="/admin"
                  icon={<Shield size={15} />}
                  accent
                  onSelect={() => setOpen(false)}
                >
                  Admin Panel
                </MenuItem>
              )}
            </ul>

            {/* Sign-out */}
            <div className="border-t border-[var(--glass-border)] pt-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  setOpen(false);
                  await signOut();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm",
                  "text-[var(--accent-red)]",
                  "hover:bg-[var(--accent-red)]/10",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:bg-[var(--accent-red)]/10",
                )}
              >
                <LogOut size={15} />
                <span>Kijelentkezés</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MenuItem
// ─────────────────────────────────────────────────────────────────────

interface MenuItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  /** Highlights the item with the gold accent (for Admin Panel). */
  accent?: boolean;
  onSelect: () => void;
}

function MenuItem({ href, icon, children, accent, onSelect }: MenuItemProps) {
  return (
    <li>
      <Link
        href={href}
        role="menuitem"
        onClick={onSelect}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm",
          "transition-colors duration-150",
          "hover:bg-[var(--glass-bg-hover)]",
          "focus-visible:outline-none focus-visible:bg-[var(--glass-bg-hover)]",
          accent
            ? "text-[var(--accent-gold)]"
            : "text-[var(--text-primary)]",
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            accent
              ? "bg-[var(--accent-gold)]/12 text-[var(--accent-gold)]"
              : "bg-[var(--glass-bg)] text-[var(--text-secondary)]",
          )}
        >
          {icon}
        </span>
        {children}
      </Link>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────

function buildInitials(
  username: string | null | undefined,
  email: string | null,
  metadata: Record<string, unknown> | undefined,
): string {
  const meta = metadata ?? {};
  const displayName =
    (typeof username === "string" && username.trim()) ||
    (typeof meta.display_name === "string" && meta.display_name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email?.split("@")[0] ||
    "";

  if (!displayName) return "?";
  const parts = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return displayName.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
