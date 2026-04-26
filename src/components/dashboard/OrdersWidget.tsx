"use client";

import { Package } from "lucide-react";
import type { OrderStatus } from "@/types/database";
import type { OrderWithItems } from "@/lib/shop-api";
import { formatDate, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WidgetShell } from "./WidgetShell";

interface OrdersWidgetProps {
  orders: OrderWithItems[];
  index?: number;
  className?: string;
}

/**
 * "Rendeléseim" widget.
 *
 * Surfaces two things at a glance:
 *  - Number of *active* orders (anything not yet delivered/cancelled).
 *  - Detail strip for the most recent order — date, total, and a colour-
 *    coded status badge so the user instantly sees the state.
 *
 * If the user has never ordered, we show a friendly empty state pointing
 * back to the shop.
 */
export function OrdersWidget({ orders, index = 0, className }: OrdersWidgetProps) {
  const activeCount = orders.filter(isActiveStatus).length;
  const latest = orders[0] ?? null;

  return (
    <WidgetShell
      eyebrow="Rendeléseim"
      title={
        activeCount > 0
          ? `${activeCount} aktív rendelés`
          : "Nincs aktív rendelés"
      }
      cta={{ label: "Rendelési előzmények", href: "/profil" }}
      index={index}
      className={className}
    >
      {latest ? (
        <div className="space-y-4">
          {/* Latest order summary */}
          <div
            className={cn(
              "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
              "bg-[var(--glass-bg)] p-3",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Legutóbbi rendelés
                </p>
                <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                  #{latest.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <StatusBadge status={latest.status} />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div className="text-xs text-[var(--text-muted)]">
                <time dateTime={latest.created_at}>
                  {formatDate(latest.created_at)}
                </time>
                <span className="mx-1.5 text-[var(--glass-border)]">·</span>
                <span>
                  {latest.items.length}{" "}
                  {latest.items.length === 1 ? "tétel" : "tétel"}
                </span>
              </div>
              <span className="font-display text-lg tabular-nums tracking-wide text-[var(--text-primary)]">
                {formatPrice(latest.total_price)}
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Aktív" value={activeCount} accent="gold" />
            <StatTile
              label="Összes rendelés"
              value={orders.length}
              accent="default"
            />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 py-6 text-center",
            "rounded-[var(--radius-md)]",
            "border border-dashed border-[var(--glass-border)]",
            "bg-[var(--glass-bg)]",
          )}
        >
          <Package size={26} className="text-[var(--text-muted)]" aria-hidden />
          <p className="text-sm text-[var(--text-secondary)]">
            Még nem adtál le rendelést. Nézz be a shopba, és találj rá az új
            mezedre.
          </p>
        </div>
      )}
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "gold" | "default";
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] px-3 py-2.5",
      )}
    >
      <p
        className={cn(
          "font-display text-2xl leading-none tabular-nums tracking-wide",
          accent === "gold"
            ? "text-[var(--accent-gold)]"
            : "text-[var(--text-primary)]",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {label}
      </p>
    </div>
  );
}

/**
 * Pill-shaped status indicator. Colours map to the canonical OrderStatus
 * values defined in `types/database.ts` — keep these aligned with the
 * admin panel so users see the same vocabulary across surfaces.
 */
function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
        "text-[10px] font-semibold uppercase tracking-[0.18em]",
        "border",
        config.classes,
      )}
    >
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", config.dotClasses)}
      />
      {config.label}
    </span>
  );
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; classes: string; dotClasses: string }
> = {
  processing: {
    label: "Feldolgozás",
    classes:
      "border-[var(--accent-gold)] text-[var(--accent-gold)] bg-[var(--accent-gold-subtle)]",
    dotClasses: "bg-[var(--accent-gold)]",
  },
  shipped: {
    label: "Feladva",
    classes:
      "border-[var(--accent-blue)] text-[var(--accent-blue)] bg-[var(--accent-blue-subtle)]",
    dotClasses: "bg-[var(--accent-blue)]",
  },
  delivered: {
    label: "Kézbesítve",
    classes:
      "border-emerald-400/60 text-emerald-400 bg-emerald-400/10",
    dotClasses: "bg-emerald-400",
  },
  cancelled: {
    label: "Lemondva",
    classes:
      "border-[var(--accent-red)] text-[var(--accent-red)] bg-[var(--accent-red-subtle)]",
    dotClasses: "bg-[var(--accent-red)]",
  },
};

function isActiveStatus(order: { status: OrderStatus }): boolean {
  return order.status === "processing" || order.status === "shipped";
}
