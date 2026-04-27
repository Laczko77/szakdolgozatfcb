"use client";

import { Eye } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminTable,
  AdminTBody,
  AdminTD,
  AdminTH,
  AdminTHead,
  AdminTR,
} from "@/components/admin/AdminTable";
import { StatusBadge } from "./StatusBadge";
import type { AdminOrder } from "./OrderDetailDialog";

interface OrdersTableProps {
  orders: AdminOrder[];
  onView: (order: AdminOrder) => void;
}

const HU_DATE_FMT = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function OrdersTable({ orders, onView }: OrdersTableProps) {
  return (
    <AdminTable>
      <AdminTHead>
        <tr>
          <AdminTH className="w-[18%]">Rendelés</AdminTH>
          <AdminTH className="w-[28%]">Vásárló</AdminTH>
          <AdminTH className="w-[14%]">Összeg</AdminTH>
          <AdminTH className="w-[16%]">Státusz</AdminTH>
          <AdminTH className="w-[18%]">Dátum</AdminTH>
          <AdminTH className="w-[6%] text-right">Művelet</AdminTH>
        </tr>
      </AdminTHead>
      <AdminTBody>
        {orders.map((o) => (
          <AdminTR key={o.id}>
            <AdminTD>
              <button
                type="button"
                onClick={() => onView(o)}
                className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--accent-gold)] transition-colors hover:underline"
              >
                #{o.id.slice(0, 8)}
              </button>
              <p className="text-xs text-[var(--text-muted)]">
                {o.items.length} tétel
              </p>
            </AdminTD>
            <AdminTD>
              <p className="font-medium text-[var(--text-primary)]">
                {o.profile?.username ?? "—"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {o.profile?.email ?? "—"}
              </p>
            </AdminTD>
            <AdminTD>
              <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                {formatPrice(o.total_price)}
              </span>
            </AdminTD>
            <AdminTD>
              <StatusBadge status={o.status} />
            </AdminTD>
            <AdminTD>
              <span className="text-sm text-[var(--text-secondary)]">
                {HU_DATE_FMT.format(new Date(o.created_at))}
              </span>
            </AdminTD>
            <AdminTD className="text-right">
              <AdminButton
                variant="ghost"
                size="icon"
                onClick={() => onView(o)}
                aria-label={`Részletek: ${o.id.slice(0, 8)}`}
              >
                <Eye className="h-4 w-4" />
              </AdminButton>
            </AdminTD>
          </AdminTR>
        ))}
      </AdminTBody>
    </AdminTable>
  );
}
