"use client";

import { Eye, EyeOff, Star } from "lucide-react";
import type { Review } from "@/types/database";
import { cn } from "@/lib/utils";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminTable,
  AdminTBody,
  AdminTD,
  AdminTH,
  AdminTHead,
  AdminTR,
} from "@/components/admin/AdminTable";

export type AdminReview = Review & {
  product: { id: string; name: string; image_url: string | null } | null;
  profile: { id: string; email: string; username: string | null } | null;
};

interface ReviewsTableProps {
  reviews: AdminReview[];
  pendingId: string | null;
  onToggleVisibility: (review: AdminReview) => void;
}

const HU_DATE_FMT = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <div
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} csillag az 5-ből`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3.5 w-3.5",
            n <= rating
              ? "fill-[var(--accent-gold)] text-[var(--accent-gold)]"
              : "text-[var(--text-muted)]",
          )}
        />
      ))}
    </div>
  );
}

export function ReviewsTable({
  reviews,
  pendingId,
  onToggleVisibility,
}: ReviewsTableProps) {
  return (
    <AdminTable>
      <AdminTHead>
        <tr>
          <AdminTH className="w-[24%]">Termék</AdminTH>
          <AdminTH className="w-[18%]">Vásárló</AdminTH>
          <AdminTH className="w-[12%]">Értékelés</AdminTH>
          <AdminTH className="w-[24%]">Megjegyzés</AdminTH>
          <AdminTH className="w-[12%]">Státusz</AdminTH>
          <AdminTH className="w-[10%] text-right">Művelet</AdminTH>
        </tr>
      </AdminTHead>
      <AdminTBody>
        {reviews.map((r) => (
          <AdminTR key={r.id}>
            <AdminTD>
              <div className="flex items-center gap-3">
                {r.product?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.product.image_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-[var(--bg-tertiary)]/40" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--text-primary)]">
                    {r.product?.name ?? "Ismeretlen termék"}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {HU_DATE_FMT.format(new Date(r.created_at))}
                  </p>
                </div>
              </div>
            </AdminTD>
            <AdminTD>
              <p className="font-medium text-[var(--text-primary)]">
                {r.profile?.username ?? "—"}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                {r.profile?.email ?? "—"}
              </p>
            </AdminTD>
            <AdminTD>
              <StarsDisplay rating={r.rating} />
            </AdminTD>
            <AdminTD>
              {r.comment ? (
                <p className="line-clamp-2 max-w-xs text-sm text-[var(--text-secondary)]">
                  {r.comment}
                </p>
              ) : (
                <span className="text-xs italic text-[var(--text-muted)]">
                  nincs szöveges visszajelzés
                </span>
              )}
            </AdminTD>
            <AdminTD>
              {r.is_visible ? (
                <AdminBadge tone="success">
                  <Eye className="h-3 w-3" />
                  Látható
                </AdminBadge>
              ) : (
                <AdminBadge tone="danger">
                  <EyeOff className="h-3 w-3" />
                  Rejtett
                </AdminBadge>
              )}
            </AdminTD>
            <AdminTD className="text-right">
              <AdminButton
                size="sm"
                variant={r.is_visible ? "subtle" : "primary"}
                loading={pendingId === r.id}
                onClick={() => onToggleVisibility(r)}
              >
                {r.is_visible ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Elrejtés
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Megjelenítés
                  </>
                )}
              </AdminButton>
            </AdminTD>
          </AdminTR>
        ))}
      </AdminTBody>
    </AdminTable>
  );
}
