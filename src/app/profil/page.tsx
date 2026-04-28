"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { PointTransaction, Profile } from "@/types/database";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ProfileHero } from "@/components/profile/ProfileHero";
import {
  ProfileTabs,
  isProfileTabId,
  type ProfileTabId,
} from "@/components/profile/ProfileTabs";
import { OrdersTab } from "@/components/profile/OrdersTab";
import { TicketsTab } from "@/components/profile/TicketsTab";
import { WishlistTab } from "@/components/profile/WishlistTab";
import { CouponsTab } from "@/components/profile/CouponsTab";
import { PointsTab } from "@/components/profile/PointsTab";
import { SettingsTab } from "@/components/profile/SettingsTab";
import {
  fetchProfile,
  fetchPurchases,
  type OrderWithItems,
} from "@/lib/profile-api";
import { fetchPoints } from "@/lib/dashboard-api";
import { fetchMyCoupons, type RedeemedCouponWithDef } from "@/lib/coupons-api";
import { fetchMyTickets, type MyTicketsResponse } from "@/lib/tickets-api";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * /profil — F10 unified profile shell.
 *
 *  - Hero: avatar (with file-picker overlay), inline-editable username,
 *    points balance.
 *  - Five-tab body driven by `?tab=` query param so each tab is
 *    deep-linkable (linked to from the success screens, the navbar
 *    dropdown, etc.).
 *  - Tab data is fetched per-section (lazy on first activation) so the
 *    page renders fast even for users with hundreds of orders / coupons.
 *
 * Auth-gated via ProtectedRoute — anonymous users get bounced to /login
 * with `?returnUrl=/profil`.
 */
export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<ProfilePageFallback />}>
        <ProfileContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function ProfileContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { profile: authProfile } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();

  // ── Active tab synced to URL ───────────────────────────────────────
  const tabFromQuery = params.get("tab");
  const activeTab: ProfileTabId = isProfileTabId(tabFromQuery)
    ? tabFromQuery
    : "orders";

  const setActiveTab = useCallback(
    (next: ProfileTabId) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("tab", next);
      router.replace(`/profil?${sp.toString()}`, { scroll: false });
    },
    [params, router],
  );

  // ── Local profile snapshot ─────────────────────────────────────────
  // We keep a local copy so the inline editors can update it instantly
  // (the AuthProvider profile syncs back via refreshProfile()).
  const [profile, setProfile] = useState<Profile | null>(authProfile);

  // Re-hydrate from auth when it changes (e.g. after refreshProfile()).
  // Defer the setState to a microtask so React 19's eslint rule
  // (`react-hooks/set-state-in-effect`) doesn't flag it as cascading.
  useEffect(() => {
    if (!authProfile) return;
    queueMicrotask(() => setProfile(authProfile));
  }, [authProfile]);

  // Cold-fetch /api/profile if the AuthProvider hasn't populated it yet.
  // This is the same row, but the explicit fetch ensures we have the
  // canonical server shape (created_at, role, …).
  useEffect(() => {
    if (profile) return;
    const c = new AbortController();
    void (async () => {
      try {
        const fresh = await fetchProfile(c.signal);
        if (!c.signal.aborted) setProfile(fresh);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        toast.error(
          err instanceof Error ? err.message : "Profil betöltése sikertelen",
        );
      }
    })();
    return () => c.abort();
  }, [profile, toast]);

  // ── Per-tab data state ─────────────────────────────────────────────
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  // The "Jegyeim" tab uses /api/tickets (the F9 endpoint) because it
  // already partitions upcoming/past — /api/profile/purchases gives a
  // mixed timeline that we'd have to bucket again on the client.
  const [tickets, setTickets] = useState<MyTicketsResponse>({
    upcoming: [],
    past: [],
  });
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);

  const [coupons, setCoupons] = useState<RedeemedCouponWithDef[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponsLoaded, setCouponsLoaded] = useState(false);

  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [pointsTotal, setPointsTotal] = useState<number | null>(null);
  const [pointsTx, setPointsTx] = useState<PointTransaction[]>([]);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsLoaded, setPointsLoaded] = useState(false);

  // ── Fetchers — each kept idempotent so we can call them from
  //    multiple effects (initial mount, tab activation, retry after
  //    a successful order cancel, etc).
  const loadOrders = useCallback(
    async (signal: AbortSignal) => {
      setOrdersLoading(true);
      try {
        const data = await fetchPurchases(signal);
        if (signal.aborted) return;
        setOrders(data.orders);
        setOrdersLoaded(true);
      } catch (err) {
        if (signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Rendelések betöltése sikertelen",
        );
      } finally {
        if (!signal.aborted) setOrdersLoading(false);
      }
    },
    [toast],
  );

  const loadTickets = useCallback(
    async (signal: AbortSignal) => {
      setTicketsLoading(true);
      try {
        const data = await fetchMyTickets(signal);
        if (signal.aborted) return;
        setTickets(data);
        setTicketsLoaded(true);
      } catch (err) {
        if (signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Jegyek betöltése sikertelen",
        );
      } finally {
        if (!signal.aborted) setTicketsLoading(false);
      }
    },
    [toast],
  );

  const loadCoupons = useCallback(
    async (signal: AbortSignal) => {
      setCouponsLoading(true);
      try {
        const list = await fetchMyCoupons({ signal });
        if (signal.aborted) return;
        setCoupons(list);
        setCouponsLoaded(true);
      } catch (err) {
        if (signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Kuponok betöltése sikertelen",
        );
      } finally {
        if (!signal.aborted) setCouponsLoading(false);
      }
    },
    [toast],
  );

  const loadPoints = useCallback(
    async (signal: AbortSignal) => {
      setPointsLoading(true);
      try {
        const res = await fetchPoints(signal);
        if (signal.aborted) return;
        setPointsBalance(res.balance.balance);
        setPointsTotal(res.balance.total_earned);
        setPointsTx(res.transactions);
        setPointsLoaded(true);
      } catch (err) {
        if (signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Pontegyenleg betöltése sikertelen",
        );
      } finally {
        if (!signal.aborted) setPointsLoading(false);
      }
    },
    [toast],
  );

  // ── Eager load: the points balance for the hero, regardless of tab.
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      void loadPoints(c.signal);
    });
    return () => c.abort();
  }, [loadPoints]);

  // ── Lazy per-tab loading. We honour the active tab on mount and on
  //    every tab change — but we never re-fetch a tab that has already
  //    loaded (cheap navigation between tabs after the first visit).
  useEffect(() => {
    const c = new AbortController();
    queueMicrotask(() => {
      if (c.signal.aborted) return;
      if (activeTab === "orders" && !ordersLoaded) {
        void loadOrders(c.signal);
      } else if (activeTab === "tickets" && !ticketsLoaded) {
        void loadTickets(c.signal);
      } else if (activeTab === "coupons" && !couponsLoaded) {
        void loadCoupons(c.signal);
      }
    });
    return () => c.abort();
  }, [
    activeTab,
    ordersLoaded,
    ticketsLoaded,
    couponsLoaded,
    loadOrders,
    loadTickets,
    loadCoupons,
  ]);

  const reloadOrdersAfterCancel = useCallback(() => {
    const c = new AbortController();
    setOrdersLoaded(false);
    void loadOrders(c.signal);
  }, [loadOrders]);

  // ── Loading skeleton until we have the profile row.
  if (!profile) {
    return <ProfilePageFallback />;
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* ── Eyebrow ─────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-5 sm:mb-6"
      >
        <h1
          className={cn(
            "font-display leading-none tracking-wider",
            "text-[var(--text-primary)] text-4xl sm:text-6xl",
          )}
        >
          Profilom
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          Itt találod a fiókod adatait, vásárlási előzményeidet, jegyeidet,
          kuponjaidat és pontmozgásaidat — egy helyen.
        </p>
      </motion.header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <ProfileHero
        profile={profile}
        pointsBalance={pointsBalance}
        pointsLoading={pointsLoading}
        onUpdated={setProfile}
      />

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="mt-7 sm:mt-8">
        <ProfileTabs active={activeTab} onChange={setActiveTab} />
      </div>

      {/* ── Tab panel ───────────────────────────────────────── */}
      <div className="mt-6 sm:mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`profile-panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`profile-tab-${activeTab}`}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduced ? 0.12 : 0.28, ease: "easeOut" }}
          >
            {activeTab === "orders" && (
              <OrdersTab
                orders={orders}
                loading={ordersLoading && !ordersLoaded}
                onOrderCancelled={reloadOrdersAfterCancel}
              />
            )}
            {activeTab === "tickets" && (
              <TicketsTab
                data={tickets}
                loading={ticketsLoading && !ticketsLoaded}
              />
            )}
            {activeTab === "wishlist" && <WishlistTab />}
            {activeTab === "coupons" && (
              <CouponsTab
                coupons={coupons}
                loading={couponsLoading && !couponsLoaded}
              />
            )}
            {activeTab === "points" && (
              <PointsTab
                balance={pointsBalance}
                totalEarned={pointsTotal}
                transactions={pointsTx}
                loading={pointsLoading && !pointsLoaded}
              />
            )}
            {activeTab === "settings" && (
              <SettingsTab profile={profile} onUpdated={setProfile} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton fallback while AuthProvider hydrates / Suspense waits for params
// ---------------------------------------------------------------------------

function ProfilePageFallback() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14">
      <div
        aria-hidden
        className={cn(
          "h-8 w-40 animate-pulse rounded-full",
          "bg-[var(--glass-bg-hover)]",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "mt-6 h-44 animate-pulse rounded-[var(--radius-lg)]",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "mt-7 h-12 animate-pulse rounded-full",
          "bg-[var(--glass-bg-hover)]",
        )}
      />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            className={cn(
              "h-32 animate-pulse rounded-[var(--radius-lg)]",
              "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            )}
          />
        ))}
      </div>
    </div>
  );
}

