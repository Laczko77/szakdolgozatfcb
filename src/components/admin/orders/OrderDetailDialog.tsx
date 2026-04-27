"use client";

import { useState } from "react";
import { ArrowRight, Truck, CheckCircle2, XCircle } from "lucide-react";
import type { Order, OrderItem, OrderStatus, ProductVariant } from "@/types/database";
import { formatPrice } from "@/lib/format";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "@/components/admin/AdminDialog";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "./StatusBadge";

type AdminOrderItem = OrderItem & {
  variant:
    | (ProductVariant & {
        product: { id: string; name: string; image_url: string | null } | null;
      })
    | null;
};

export interface AdminOrder extends Order {
  items: AdminOrderItem[];
  profile: { id: string; email: string; username: string | null } | null;
}

interface OrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: AdminOrder | null;
  onChanged: () => void;
}

const HU_DATETIME_FMT = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "long",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const ALLOWED_TRANSITIONS: Record<
  OrderStatus,
  Array<{ next: OrderStatus; label: string; icon: React.ComponentType<{ className?: string }>; variant: "primary" | "danger" }>
> = {
  processing: [
    { next: "shipped", label: "Feladás", icon: Truck, variant: "primary" },
    { next: "cancelled", label: "Lemondás", icon: XCircle, variant: "danger" },
  ],
  shipped: [
    { next: "delivered", label: "Kézbesítve", icon: CheckCircle2, variant: "primary" },
  ],
  delivered: [],
  cancelled: [],
};

export function OrderDetailDialog({
  open,
  onOpenChange,
  order,
  onChanged,
}: OrderDetailDialogProps) {
  const [confirmTarget, setConfirmTarget] = useState<OrderStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!order) return null;

  const transitions = ALLOWED_TRANSITIONS[order.status];

  async function commit(nextStatus: OrderStatus) {
    if (!order) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Státusz frissítése sikertelen");
      }
      setConfirmTarget(null);
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Státusz frissítése sikertelen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AdminDialogRoot open={open} onOpenChange={onOpenChange}>
        <AdminDialogContent open={open} size="lg">
          <AdminDialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <AdminDialogTitle>
                  Rendelés #{order.id.slice(0, 8)}
                </AdminDialogTitle>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {HU_DATETIME_FMT.format(new Date(order.created_at))}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>
          </AdminDialogHeader>

          <AdminDialogBody className="space-y-5">
            {/* Customer */}
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Vásárló
              </h3>
              <div className="rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3">
                <p className="font-medium text-[var(--text-primary)]">
                  {order.profile?.username ?? "—"}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {order.profile?.email ?? "—"}
                </p>
              </div>
            </section>

            {/* Shipping */}
            {order.shipping_address ? (
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Szállítási cím
                </h3>
                <div className="rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)]">
                  <p className="font-medium">{order.shipping_address.full_name}</p>
                  <p className="text-[var(--text-secondary)]">
                    {order.shipping_address.street}
                    <br />
                    {order.shipping_address.postal_code}{" "}
                    {order.shipping_address.city}, {order.shipping_address.country}
                    {order.shipping_address.phone ? (
                      <>
                        <br />
                        Tel.: {order.shipping_address.phone}
                      </>
                    ) : null}
                  </p>
                </div>
              </section>
            ) : null}

            {/* Items */}
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Tételek
              </h3>
              <div className="overflow-hidden rounded-md border border-[var(--glass-border)]">
                {order.items.map((item, idx) => {
                  const variantLabel = [
                    item.variant?.size,
                    item.variant?.color,
                  ]
                    .filter(Boolean)
                    .join(" / ");
                  return (
                    <div
                      key={item.id}
                      className={
                        idx === 0
                          ? "flex items-center gap-3 bg-[var(--bg-primary)] px-4 py-3"
                          : "flex items-center gap-3 border-t border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3"
                      }
                    >
                      {item.variant?.product?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.variant.product.image_url}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded bg-[var(--bg-tertiary)]/40" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--text-primary)]">
                          {item.variant?.product?.name ?? "Ismeretlen termék"}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {variantLabel || "—"} · {item.quantity} db
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                          {formatPrice(item.unit_price * item.quantity)}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {formatPrice(item.unit_price)} / db
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between border-t border-[var(--glass-border)] bg-[var(--bg-tertiary)]/30 px-4 py-3">
                  <span className="font-display text-sm uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                    Végösszeg
                  </span>
                  <span className="font-mono text-base font-semibold tabular-nums text-[var(--accent-gold)]">
                    {formatPrice(order.total_price)}
                  </span>
                </div>
              </div>
            </section>

            {error ? (
              <div
                role="alert"
                className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]"
              >
                {error}
              </div>
            ) : null}
          </AdminDialogBody>

          <AdminDialogFooter>
            <AdminButton variant="subtle" onClick={() => onOpenChange(false)}>
              Bezárás
            </AdminButton>
            {transitions.map((t) => {
              const Icon = t.icon;
              return (
                <AdminButton
                  key={t.next}
                  variant={t.variant}
                  onClick={() => setConfirmTarget(t.next)}
                  disabled={submitting}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  <ArrowRight className="h-4 w-4 opacity-70" />
                </AdminButton>
              );
            })}
          </AdminDialogFooter>
        </AdminDialogContent>
      </AdminDialogRoot>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
        title="Státusz módosítás"
        description={
          confirmTarget
            ? `Biztosan átállítod a rendelést "${confirmTarget}" állapotba? A vásárló e-mail értesítést kaphat.`
            : ""
        }
        confirmLabel="Igen, módosítás"
        variant={confirmTarget === "cancelled" ? "danger" : "primary"}
        loading={submitting}
        onConfirm={() => confirmTarget && void commit(confirmTarget)}
      />
    </>
  );
}
