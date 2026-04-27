"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Package,
  ShoppingBag,
} from "lucide-react";
import type { OrderStatus } from "@/types/database";
import type { OrderWithItems } from "@/lib/profile-api";
import { formatDateTime, formatPrice } from "@/lib/format";
import { OrderCancelButton } from "@/components/shop/OrderCancelButton";
import { cn } from "@/lib/utils";

/**
 * /profil → Rendeléseim tab.
 *
 * Stateless presentational component — the parent fetches the data and
 * passes it in. The list is timeline-ordered (newest first) by the
 * server. Each order renders as an expandable card showing its line
 * items, a status badge, and (when allowed) the F8.8 cancel button.
 */

interface OrdersTabProps {
  orders: OrderWithItems[];
  loading: boolean;
  onOrderCancelled?: () => void;
}

export function OrdersTab({
  orders,
  loading,
  onOrderCancelled,
}: OrdersTabProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            className={cn(
              "h-[160px] animate-pulse rounded-[var(--radius-lg)]",
              "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            )}
          />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBag size={22} />}
        title="Még nincs rendelésed"
        description="A leadott webshop rendeléseid itt fognak megjelenni — szállítási státusszal és a megrendelt tételekkel együtt."
        cta={{ label: "Shop böngészése", href: "/shop" }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order, i) => (
        <OrderCard
          key={order.id}
          order={order}
          index={i}
          onCancelled={onOrderCancelled}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order card
// ---------------------------------------------------------------------------

function OrderCard({
  order,
  index,
  onCancelled,
}: {
  order: OrderWithItems;
  index: number;
  onCancelled?: () => void;
}) {
  const totalUnits = order.items.reduce((s, it) => s + it.quantity, 0);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.04, 0.24),
        ease: "easeOut",
      }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)]",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "backdrop-blur-md transition-colors duration-300",
        "hover:bg-[var(--glass-bg-hover)]",
      )}
    >
      <header
        className={cn(
          "flex flex-wrap items-center gap-3 px-5 py-4",
          "border-b border-[var(--glass-border)]",
        )}
      >
        <div className="min-w-0">
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
            Rendelés #{order.id.slice(0, 8)}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
            <CalendarDays size={11} aria-hidden />
            {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="font-display text-lg tracking-wide text-[var(--accent-gold)] tabular-nums">
            {formatPrice(Number(order.total_price))}
          </span>
        </div>
      </header>

      <div className="px-5 py-4">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {totalUnits} {totalUnits === 1 ? "tétel" : "tétel"} ·{" "}
          {order.items.length} termékfajta
        </p>

        <ul className="mt-3 space-y-2.5">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <ProductThumb
                src={item.variant?.product?.image_url ?? null}
                alt={item.variant?.product?.name ?? "Termék"}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {item.variant?.product?.name ?? "Ismeretlen termék"}
                </p>
                <p className="truncate text-[11px] text-[var(--text-muted)]">
                  {[
                    item.variant?.size,
                    item.variant?.color,
                    `${item.quantity} db`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="font-display text-sm tabular-nums text-[var(--text-secondary)]">
                {formatPrice(Number(item.unit_price) * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {order.status !== "cancelled" &&
          order.status !== "shipped" &&
          order.status !== "delivered" && (
            <div className="mt-4 flex justify-end">
              <OrderCancelButton
                orderId={order.id}
                status={order.status}
                onCancelled={onCancelled}
              />
            </div>
          )}
      </div>
    </motion.article>
  );
}

function ProductThumb({
  src,
  alt,
}: {
  src: string | null;
  alt: string;
}) {
  return (
    <div
      className={cn(
        "relative h-10 w-10 shrink-0 overflow-hidden rounded-md",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="40px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]"
        >
          <Package size={14} />
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<OrderStatus, string> = {
  processing: "Feldolgozás",
  shipped: "Feladva",
  delivered: "Kézbesítve",
  cancelled: "Lemondva",
};

const STATUS_ACCENT: Record<OrderStatus, string> = {
  processing: "var(--accent-gold)",
  shipped: "var(--accent-blue)",
  delivered: "#22c55e",
  cancelled: "var(--accent-red)",
};

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label = STATUS_LABEL[status];
  const color = STATUS_ACCENT[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full",
        "border px-2.5 py-1",
        "font-display text-[10px] uppercase tracking-[0.22em]",
      )}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({
  icon,
  title,
  description,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-4 p-10 text-center sm:p-14">
      <div
        aria-hidden
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "text-[var(--accent-gold)]",
        )}
      >
        {icon}
      </div>
      <h3 className="font-display text-2xl tracking-wide text-[var(--text-primary)]">
        {title}
      </h3>
      <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
      {cta && (
        <Link href={cta.href} className="glass-button-primary mt-2">
          {cta.label}
        </Link>
      )}
    </div>
  );
}
