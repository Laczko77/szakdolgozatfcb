"use client";

import { useCallback, useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import type { OrderStatus } from "@/types/database";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
} from "@/components/admin/AdminCard";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  AdminTableContainer,
  AdminTableEmpty,
  AdminTableSkeleton,
} from "@/components/admin/AdminTable";
import { Pagination } from "@/components/admin/Pagination";
import {
  OrderDetailDialog,
  type AdminOrder,
} from "@/components/admin/orders/OrderDetailDialog";
import { OrdersTable } from "@/components/admin/orders/OrdersTable";
import { ORDER_STATUS_LABEL } from "@/components/admin/orders/StatusBadge";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: Array<OrderStatus | "all"> = [
  "all",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

interface OrderListResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeOrder, setActiveOrder] = useState<AdminOrder | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        if (statusFilter !== "all") params.set("status", statusFilter);

        const response = await fetch(
          `/api/admin/orders?${params.toString()}`,
          { cache: "no-store", signal },
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Rendelések lekérése sikertelen");
        }
        const data = (await response.json()) as OrderListResponse;
        if (signal.aborted) return;
        setOrders(data.orders);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "Hiba a betöltés során");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, statusFilter],
  );

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      void load(ac.signal);
    });
    return () => ac.abort();
  }, [load]);

  const reload = useCallback(() => {
    const ac = new AbortController();
    void load(ac.signal);
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-gold)]">
          Kereskedelem
        </p>
        <h1 className="font-display text-3xl uppercase tracking-[0.04em] text-[var(--text-primary)] md:text-4xl">
          Rendelések
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {total} rendelés{statusFilter !== "all" ? ` · ${ORDER_STATUS_LABEL[statusFilter]}` : ""}.
        </p>
      </header>

      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Lista</AdminCardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Státusz
            </span>
            <div className="w-44">
              <AdminSelect
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value as OrderStatus | "all");
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "Mind" : ORDER_STATUS_LABEL[s]}
                  </option>
                ))}
              </AdminSelect>
            </div>
          </div>
        </AdminCardHeader>

        <AdminTableContainer className="rounded-none border-x-0 border-b-0">
          {loading ? (
            <table className="w-full border-collapse text-sm">
              <AdminTableSkeleton columns={6} rows={6} />
            </table>
          ) : error ? (
            <AdminTableEmpty
              icon={<ShoppingBag className="h-5 w-5" />}
              title="Hiba történt"
              description={error}
              action={
                <AdminButton variant="secondary" onClick={reload}>
                  Újra
                </AdminButton>
              }
            />
          ) : orders.length === 0 ? (
            <AdminTableEmpty
              icon={<ShoppingBag className="h-5 w-5" />}
              title="Nincs rendelés"
              description={
                statusFilter !== "all"
                  ? "Ebben az állapotban nincs rendelés."
                  : "A boltban még nem érkezett rendelés."
              }
            />
          ) : (
            <OrdersTable orders={orders} onView={setActiveOrder} />
          )}
        </AdminTableContainer>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalLabel={
            total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}`
              : undefined
          }
        />
      </AdminCard>

      <OrderDetailDialog
        open={activeOrder !== null}
        onOpenChange={(o) => !o && setActiveOrder(null)}
        order={activeOrder}
        onChanged={reload}
      />
    </div>
  );
}
