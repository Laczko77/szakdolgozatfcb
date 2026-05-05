"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Coins,
  FileText,
  MessageSquare,
  Newspaper,
  Package,
  ShoppingBag,
  Star,
  Ticket,
  Users,
  Vote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavGroup {
  label: string;
  items: NavItem[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Sidebar nav config — grouped semantically rather than alphabetically.
 * Matches the F15 backlog scope (cikkek, termékek, rendelések, meccsek,
 * játékosok, posztok, szavazások, kuponok, analitika, értékelések).
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Tartalom",
    items: [
      { href: "/admin/cikkek", label: "Cikkek", icon: Newspaper },
      { href: "/admin/posztok", label: "Posztok", icon: MessageSquare },
      { href: "/admin/szavazasok", label: "Szavazások", icon: Vote },
    ],
  },
  {
    label: "Sport",
    items: [
      { href: "/admin/meccsek", label: "Meccsek", icon: Ticket },
      { href: "/admin/jatekosok", label: "Játékosok", icon: Users },
    ],
  },
  {
    label: "Kereskedelem",
    items: [
      { href: "/admin/termekek", label: "Termékek", icon: Package },
      { href: "/admin/rendelesek", label: "Rendelések", icon: ShoppingBag },
      { href: "/admin/kuponok", label: "Kuponok", icon: Coins },
      { href: "/admin/ertekelesek", label: "Értékelések", icon: Star },
    ],
  },
  {
    label: "Elemzés",
    items: [
      { href: "/admin/analitika", label: "Analitika", icon: BarChart3 },
    ],
  },
];

interface AdminSidebarProps {
  /** Optional: closes the mobile drawer when an item is selected. */
  onNavigate?: () => void;
  /** When true the sidebar is rendered inside the mobile drawer. */
  mobile?: boolean;
}

export function AdminSidebar({ onNavigate, mobile = false }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col bg-[var(--bg-secondary)]",
        mobile ? null : "border-r border-[var(--glass-border)]",
      )}
    >
      <div className="flex h-14 items-center gap-3 border-b border-[var(--glass-border)] px-5">
        <Image
          src="/images/logo/logo.png"
          alt="FC Barcelona"
          width={59}
          height={32}
          className="h-8 w-auto select-none"
        />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base uppercase tracking-[0.1em] text-[var(--text-primary)]">
            Admin Panel
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Barcapulse
          </span>
        </div>
      </div>

      <nav
        aria-label="Admin navigáció"
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                        active
                          ? "bg-[var(--accent-gold)]/10 text-[var(--accent-gold)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-[var(--accent-gold)]"
                        />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-60" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--glass-border)] px-5 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)]"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Vissza a publikus oldalra</span>
        </Link>
      </div>
    </aside>
  );
}

// Re-export for breadcrumb / topbar utilities
export const ADMIN_NAV_GROUPS = NAV_GROUPS;

export function findActiveNavItem(pathname: string): NavItem | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
        return item;
      }
    }
  }
  return null;
}

// Lightweight icon for the sidebar header — kept here so the file is
// self-contained when imported by the topbar.
export { ClipboardList };
