import { Home, ShoppingBag, Ticket, Users, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Centralized navigation definitions.
 *
 * Both the desktop pill navbar and the mobile bottom-tab bar consume this
 * file so route changes only need to happen in one place. Using a `Map`
 * shape would be safer typing-wise, but plain readonly arrays render
 * cleanly with `.map()` in JSX, which is the dominant call site.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface TabLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Desktop pill navbar — links shown in the centre cluster. */
export const desktopNavLinks: readonly NavLink[] = [
  { label: "Hírek", href: "/hirek" },
  { label: "Shop", href: "/shop" },
  { label: "Jegyek", href: "/jegyek" },
  { label: "Játékosok", href: "/jatekosok" },
  { label: "Közösség", href: "/kozosseg" },
] as const;

/** Mobile bottom tab bar — exactly five tabs. */
export const mobileTabs: readonly TabLink[] = [
  { label: "Főoldal", href: "/", icon: Home },
  { label: "Shop", href: "/shop", icon: ShoppingBag },
  { label: "Jegyek", href: "/jegyek", icon: Ticket },
  { label: "Közösség", href: "/kozosseg", icon: Users },
  { label: "Profil", href: "/profil", icon: User },
] as const;

/**
 * Active-route helper used by both navigations.
 * - "/" matches the home page exactly (no `startsWith` — every path begins with `/`).
 * - Other routes match if pathname starts with the link's href, so `/shop/123`
 *   keeps the "Shop" tab highlighted on detail pages.
 */
export function isRouteActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
