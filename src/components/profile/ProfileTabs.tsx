"use client";

import { motion } from "framer-motion";
import {
  Coins,
  Settings as SettingsIcon,
  ShoppingBag,
  Ticket,
  TicketPercent,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Tab strip for the /profil shell.
 *
 * Desktop: a row of underline pills with a `layoutId`-animated gold
 * indicator that morphs between active tabs.
 *
 * Mobile: a horizontally scrollable strip of compact pill buttons. The
 * snap behaviour is intentional — users can flick between tabs the same
 * way they do on the news category pills.
 *
 * The tab id is the source of truth and is round-tripped through the URL
 * query (`?tab=...`) by the parent so deep-linking works.
 */

export type ProfileTabId =
  | "orders"
  | "tickets"
  | "coupons"
  | "points"
  | "settings";

interface TabDef {
  id: ProfileTabId;
  label: string;
  icon: LucideIcon;
}

export const PROFILE_TABS: readonly TabDef[] = [
  { id: "orders", label: "Rendeléseim", icon: ShoppingBag },
  { id: "tickets", label: "Jegyeim", icon: Ticket },
  { id: "coupons", label: "Kuponjaim", icon: TicketPercent },
  { id: "points", label: "Pontjaim", icon: Coins },
  { id: "settings", label: "Beállítások", icon: SettingsIcon },
] as const;

export function isProfileTabId(value: string | null): value is ProfileTabId {
  return (
    value === "orders" ||
    value === "tickets" ||
    value === "coupons" ||
    value === "points" ||
    value === "settings"
  );
}

interface ProfileTabsProps {
  active: ProfileTabId;
  onChange: (next: ProfileTabId) => void;
}

export function ProfileTabs({ active, onChange }: ProfileTabsProps) {
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label="Profil szekciók"
      className={cn(
        "relative isolate flex gap-1 overflow-x-auto scrollbar-none",
        "rounded-full border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] p-1",
        "[scrollbar-width:none] [-ms-overflow-style:none]",
        "[&::-webkit-scrollbar]:hidden",
      )}
    >
      {PROFILE_TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`profile-panel-${tab.id}`}
            id={`profile-tab-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleArrow(e, tab.id, onChange)}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2",
              "text-xs font-medium whitespace-nowrap",
              "transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              selected
                ? "text-[var(--bg-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "sm:px-4 sm:text-sm",
            )}
          >
            {selected && (
              <motion.span
                layoutId="profile-tab-pill"
                aria-hidden
                className={cn(
                  "absolute inset-0 -z-10 rounded-full",
                  "bg-[var(--accent-gold)]",
                  "shadow-[var(--shadow-glow-gold)]",
                )}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 32 }
                }
              />
            )}
            <Icon
              size={14}
              strokeWidth={selected ? 2.2 : 1.8}
              aria-hidden
              className={cn(
                "shrink-0",
                selected ? "" : "text-[var(--text-muted)]",
              )}
            />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function handleArrow(
  e: React.KeyboardEvent<HTMLButtonElement>,
  current: ProfileTabId,
  onChange: (next: ProfileTabId) => void,
) {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  e.preventDefault();
  const idx = PROFILE_TABS.findIndex((t) => t.id === current);
  if (idx < 0) return;
  const delta = e.key === "ArrowRight" ? 1 : -1;
  const next = PROFILE_TABS[(idx + delta + PROFILE_TABS.length) % PROFILE_TABS.length];
  onChange(next.id);
  // Move focus to the new tab so screen reader announcements line up.
  window.requestAnimationFrame(() => {
    document.getElementById(`profile-tab-${next.id}`)?.focus();
  });
}
