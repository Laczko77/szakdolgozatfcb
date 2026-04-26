"use client";

import { useEffect, useState } from "react";
import type { Article, Match, PointTransaction } from "@/types/database";
import type { OrderWithItems } from "@/lib/shop-api";
import type { EnrichedPoll } from "@/lib/polls-api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { fetchOrders } from "@/lib/shop-api";
import {
  fetchLatestArticles,
  fetchNextMatch,
  fetchPoints,
} from "@/lib/dashboard-api";
import { fetchPolls } from "@/lib/polls-api";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { NextMatchWidget } from "@/components/dashboard/NextMatchWidget";
import { LatestNewsWidget } from "@/components/dashboard/LatestNewsWidget";
import { PointsWidget } from "@/components/dashboard/PointsWidget";
import { OrdersWidget } from "@/components/dashboard/OrdersWidget";
import { ActivePollWidget } from "@/components/dashboard/ActivePollWidget";
import { QuickLinks } from "@/components/dashboard/QuickLinks";
import {
  DashboardHeroSkeleton,
  WidgetSkeleton,
} from "@/components/dashboard/WidgetSkeleton";
import { cn } from "@/lib/utils";

/**
 * /dashboard — the bejelentkezett user "napi központ".
 *
 * Layout:
 *  - 12-column CSS grid on desktop, single column on mobile.
 *  - Hero greeting spans the full row, then the next-match widget
 *    (8 cols) sits next to the points balance (4 cols), then latest
 *    news (8) + orders summary (4), and finally the quick-links strip.
 *
 * Data:
 *  - Four parallel `fetch()` calls fired off in a single `Promise.all`
 *    so the dashboard's TTFB is the slowest endpoint, not their sum.
 *  - Every widget surfaces its own loading skeleton; we do NOT block
 *    the whole page on a single slow call.
 *  - Failures are caught individually so a flaky news endpoint can't
 *    take the dashboard offline. The user sees a toast + an empty
 *    state for the affected widget.
 *
 * The route is wrapped with {@link ProtectedRoute} — `/dashboard` only
 * makes sense for authenticated users, and the guard handles the
 * `?returnUrl=` redirect dance for us.
 */

interface DashboardData {
  match: Match | null;
  matchLoaded: boolean;
  articles: Article[];
  articlesLoaded: boolean;
  pointsBalance: number;
  pointsTotalEarned: number;
  lastPointTransaction: PointTransaction | null;
  pointsLoaded: boolean;
  orders: OrderWithItems[];
  ordersLoaded: boolean;
  activePoll: EnrichedPoll | null;
  pollLoaded: boolean;
}

const initialData: DashboardData = {
  match: null,
  matchLoaded: false,
  articles: [],
  articlesLoaded: false,
  pointsBalance: 0,
  pointsTotalEarned: 0,
  lastPointTransaction: null,
  pointsLoaded: false,
  orders: [],
  ordersLoaded: false,
  activePoll: null,
  pollLoaded: false,
};

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<DashboardData>(initialData);

  useEffect(() => {
    const controller = new AbortController();

    // Fire each request independently and resolve them on the state
    // separately. This keeps a slow endpoint from blocking the rest of
    // the dashboard, and lets us toast just the offending fetch.
    const tasks = [
      fetchNextMatch(controller.signal)
        .then((match) => {
          setData((prev) => ({ ...prev, match, matchLoaded: true }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setData((prev) => ({ ...prev, matchLoaded: true }));
          toast.error(
            err instanceof Error
              ? err.message
              : "Nem sikerült betölteni a következő mérkőzést",
          );
        }),

      fetchLatestArticles(controller.signal)
        .then((articles) => {
          setData((prev) => ({ ...prev, articles, articlesLoaded: true }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setData((prev) => ({ ...prev, articlesLoaded: true }));
          toast.error(
            err instanceof Error ? err.message : "Hírek betöltése sikertelen",
          );
        }),

      fetchPoints(controller.signal)
        .then((res) => {
          setData((prev) => ({
            ...prev,
            pointsBalance: res.balance.balance,
            pointsTotalEarned: res.balance.total_earned,
            lastPointTransaction: res.transactions[0] ?? null,
            pointsLoaded: true,
          }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setData((prev) => ({ ...prev, pointsLoaded: true }));
          toast.error(
            err instanceof Error
              ? err.message
              : "Pontegyenleg betöltése sikertelen",
          );
        }),

      fetchOrders()
        .then((res) => {
          setData((prev) => ({
            ...prev,
            orders: res.orders,
            ordersLoaded: true,
          }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setData((prev) => ({ ...prev, ordersLoaded: true }));
          toast.error(
            err instanceof Error
              ? err.message
              : "Rendelések betöltése sikertelen",
          );
        }),

      fetchPolls({ status: "active" }, controller.signal)
        .then((polls) => {
          // Newest active poll only — matches the F12.4 spec ("legfrissebb").
          setData((prev) => ({
            ...prev,
            activePoll: polls[0] ?? null,
            pollLoaded: true,
          }));
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setData((prev) => ({ ...prev, pollLoaded: true }));
          // Polls failing should never break the dashboard — quiet error.
          toast.error(
            err instanceof Error
              ? err.message
              : "Aktív szavazás betöltése sikertelen",
          );
        }),
    ];

    void Promise.all(tasks);

    return () => controller.abort();
    // We intentionally only depend on `user.id` — re-running the fetches
    // on every toast / profile reference would be wasteful and could
    // double-fire on the first paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Hero */}
      {profile === null && data.matchLoaded === false ? (
        // We can't reliably tell if the profile is "missing" or "still
        // loading" — but during the first paint we'd rather show the
        // skeleton than a placeholder name.  Once any widget has
        // resolved we fall through to the real hero.
        <DashboardHeroSkeleton />
      ) : (
        <DashboardHero profile={profile} email={user?.email ?? null} />
      )}

      {/* Widget grid */}
      <div
        className={cn(
          "mt-6 grid gap-5 sm:gap-6 sm:mt-8",
          "grid-cols-1 lg:grid-cols-12",
        )}
      >
        {/* Row 1 — Match (8) + Points (4) */}
        {data.matchLoaded ? (
          <NextMatchWidget
            match={data.match}
            index={0}
            className="lg:col-span-8"
          />
        ) : (
          <WidgetSkeleton className="lg:col-span-8" rows={4} />
        )}

        {data.pointsLoaded ? (
          <PointsWidget
            balance={data.pointsBalance}
            totalEarned={data.pointsTotalEarned}
            lastTransaction={data.lastPointTransaction}
            index={1}
            className="lg:col-span-4"
          />
        ) : (
          <WidgetSkeleton className="lg:col-span-4" rows={3} />
        )}

        {/* Row 2 — News (8) + Orders (4) */}
        {data.articlesLoaded ? (
          <LatestNewsWidget
            articles={data.articles}
            index={2}
            className="lg:col-span-8"
          />
        ) : (
          <WidgetSkeleton className="lg:col-span-8" rows={4} />
        )}

        {data.ordersLoaded ? (
          <OrdersWidget
            orders={data.orders}
            index={3}
            className="lg:col-span-4"
          />
        ) : (
          <WidgetSkeleton className="lg:col-span-4" rows={3} />
        )}

        {/* Row 3 — Active poll (full width) */}
        {data.pollLoaded ? (
          <ActivePollWidget
            poll={data.activePoll}
            index={4}
            onVoteCast={() => {
              // Re-fetch the poll + points so the widget collapses to its
              // "voted" state and the points balance reflects any reward.
              void Promise.all([
                fetchPolls({ status: "active" }).then((polls) =>
                  setData((prev) => ({
                    ...prev,
                    activePoll: polls[0] ?? null,
                  })),
                ),
                fetchPoints().then((res) =>
                  setData((prev) => ({
                    ...prev,
                    pointsBalance: res.balance.balance,
                    pointsTotalEarned: res.balance.total_earned,
                    lastPointTransaction: res.transactions[0] ?? null,
                  })),
                ),
              ]).catch(() => {
                /* swallow — toasts in the children already surface failure */
              });
            }}
            className="lg:col-span-12"
          />
        ) : (
          <WidgetSkeleton className="lg:col-span-12" rows={3} />
        )}

        {/* Row 4 — Quick links (full width) */}
        <QuickLinks index={5} className="lg:col-span-12" />
      </div>
    </div>
  );
}
