import { CheckCircle2, Clock, Package, Truck, XCircle } from "lucide-react";
import type { OrderStatus } from "@/types/database";
import { AdminBadge } from "@/components/admin/AdminBadge";

const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    tone: React.ComponentProps<typeof AdminBadge>["tone"];
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  processing: { label: "Feldolgozás", tone: "warning", icon: Clock },
  shipped: { label: "Feladva", tone: "info", icon: Truck },
  delivered: { label: "Kézbesítve", tone: "success", icon: CheckCircle2 },
  cancelled: { label: "Lemondva", tone: "danger", icon: XCircle },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <AdminBadge tone={cfg.tone}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </AdminBadge>
  );
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = Object.fromEntries(
  (Object.entries(STATUS_CONFIG) as [OrderStatus, (typeof STATUS_CONFIG)[OrderStatus]][]).map(
    ([k, v]) => [k, v.label],
  ),
) as Record<OrderStatus, string>;

export { Package };
