"use client";

import { useEffect, useState } from "react";
import type { Match } from "@/types/database";
import { fetchNextMatch } from "@/lib/dashboard-api";
import { useToast } from "@/providers/ToastProvider";
import { NextMatchWidget } from "@/components/dashboard/NextMatchWidget";
import { WidgetSkeleton } from "@/components/dashboard/WidgetSkeleton";
import type { DashboardWidgetProps } from "@/lib/dashboard-widgets";

/**
 * Self-fetching wrapper a NextMatchWidget köré.
 *
 * F30 előtt a `/dashboard` page futtatott egy közös `Promise.all`-t a
 * widget-adatokra. A customize rendszerben azonban a widgetek dinamikusan
 * jelennek meg / tűnnek el, és nem akarjuk lekérni a meccs-adatot ha a user
 * elrejtette ezt a kártyát. Ezért minden widget saját maga felel az adat-
 * lekérésért és a saját skeleton/error állapotaiért.
 */
export function NextMatchSelfWidget({ index, className }: DashboardWidgetProps) {
  const toast = useToast();
  const [match, setMatch] = useState<Match | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchNextMatch(controller.signal)
      .then((m) => {
        setMatch(m);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded(true);
        toast.error(
          err instanceof Error
            ? err.message
            : "Nem sikerült betölteni a következő mérkőzést",
        );
      });
    return () => controller.abort();
    // toast referencia nem stabil — szándékosan kihagyjuk
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return <WidgetSkeleton className={className} rows={4} />;
  return <NextMatchWidget match={match} index={index} className={className} />;
}
