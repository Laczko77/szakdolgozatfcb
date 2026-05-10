"use client";

import { useEffect, useState } from "react";
import { fetchOrders, type OrderWithItems } from "@/lib/shop-api";
import { useToast } from "@/providers/ToastProvider";
import { OrdersWidget } from "@/components/dashboard/OrdersWidget";
import { WidgetSkeleton } from "@/components/dashboard/WidgetSkeleton";
import type { DashboardWidgetProps } from "@/lib/dashboard-widgets";

export function OrdersSelfWidget({ index, className }: DashboardWidgetProps) {
  const toast = useToast();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOrders()
      .then((res) => {
        if (cancelled) return;
        setOrders(res.orders);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoaded(true);
        toast.error(
          err instanceof Error
            ? err.message
            : "Rendelések betöltése sikertelen",
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return <WidgetSkeleton className={className} rows={3} />;
  return <OrdersWidget orders={orders} index={index} className={className} />;
}
