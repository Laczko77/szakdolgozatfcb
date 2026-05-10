"use client";

import { useEffect, useState } from "react";
import type { PointTransaction } from "@/types/database";
import { fetchPoints } from "@/lib/dashboard-api";
import { useToast } from "@/providers/ToastProvider";
import { PointsWidget } from "@/components/dashboard/PointsWidget";
import { WidgetSkeleton } from "@/components/dashboard/WidgetSkeleton";
import type { DashboardWidgetProps } from "@/lib/dashboard-widgets";

export function PointsSelfWidget({ index, className }: DashboardWidgetProps) {
  const toast = useToast();
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [last, setLast] = useState<PointTransaction | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPoints(controller.signal)
      .then((res) => {
        setBalance(res.balance.balance);
        setTotalEarned(res.balance.total_earned);
        setLast(res.transactions[0] ?? null);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded(true);
        toast.error(
          err instanceof Error
            ? err.message
            : "Pontegyenleg betöltése sikertelen",
        );
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return <WidgetSkeleton className={className} rows={3} />;
  return (
    <PointsWidget
      balance={balance}
      totalEarned={totalEarned}
      lastTransaction={last}
      index={index}
      className={className}
    />
  );
}
