"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";

interface AdminShellProps {
  children: React.ReactNode;
}

/**
 * Top-level admin shell.
 *
 * Layout:
 *   - Desktop (md+): 240px fixed sidebar + main column (topbar + content).
 *   - Mobile (<md):  collapsed; sidebar slides in as a 280px drawer with
 *                    a dimmed scrim.
 *
 * Auth guard: the middleware (`src/middleware.ts`) already redirects
 * non-admins at the network layer before they reach this component. We
 * still mount a client-side guard for UX symmetry: if for any reason a
 * non-admin renders this shell (e.g. role flipped mid-session), we
 * redirect to /dashboard rather than showing admin chrome.
 */
export function AdminShell({ children }: AdminShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, isLoading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes. queueMicrotask
  // defers the setState call out of the effect body to avoid the
  // react-hooks/set-state-in-effect lint (cascading-render warning).
  useEffect(() => {
    queueMicrotask(() => setDrawerOpen(false));
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  // Client-side admin guard. Middleware is the source of truth, but if
  // the role changes mid-session (or middleware fails open) we want to
  // bail rather than expose the admin chrome.
  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const params = new URLSearchParams({ redirect: pathname });
      router.replace(`/login?${params.toString()}`);
      return;
    }
    if (profile && profile.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [isLoading, user, profile, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-[var(--text-secondary)]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--glass-border)] border-t-[var(--accent-gold)]" />
          <p className="font-display text-sm uppercase tracking-[0.12em]">
            Admin betöltése
          </p>
        </div>
      </div>
    );
  }

  if (!user || (profile && profile.role !== "admin")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]">
            <ShieldX className="h-5 w-5" />
          </div>
          <p className="font-display text-xl uppercase tracking-[0.06em] text-[var(--text-primary)]">
            Hozzáférés megtagadva
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Ehhez az oldalhoz admin jogosultság szükséges. Átirányítás...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Desktop sidebar — pinned, scrolls independently. */}
      <div className="hidden h-screen w-60 shrink-0 md:sticky md:top-0 md:block">
        <AdminSidebar />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Bezárás"
              onClick={() => setDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 w-72 border-r border-[var(--glass-border)] md:hidden"
            >
              <AdminSidebar mobile onNavigate={() => setDrawerOpen(false)} />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar onMenuClick={() => setDrawerOpen(true)} />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
