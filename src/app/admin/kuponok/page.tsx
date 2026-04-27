"use client";

/**
 * F15.9 — Admin: kuponok kezelése.
 *
 * - Lista:        GET /api/admin/coupons   (returns `{ coupons: CouponWithStats[] }`)
 * - Létrehozás:   POST /api/admin/coupons
 * - Frissítés:    PUT  /api/admin/coupons/[id]   (toggle is_active is just a partial update)
 * - Törlés:       DELETE /api/admin/coupons/[id]
 *
 * Note: a backend "delete" coupon is a soft delete (sets is_active = false)
 * because RedeemedCoupon FK-restricts hard removal.
 */

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Ticket, Trash2 } from "lucide-react";

import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
} from "@/components/admin/AdminCard";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "@/components/admin/AdminDialog";
import {
  AdminField,
  AdminInput,
  AdminTextarea,
} from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  AdminTable,
  AdminTBody,
  AdminTD,
  AdminTH,
  AdminTHead,
  AdminTR,
  AdminTableContainer,
  AdminTableEmpty,
  AdminTableSkeleton,
} from "@/components/admin/AdminTable";
import { adminFetch, adminFetchRaw, AdminApiError } from "@/lib/admin-fetch";
import type { Coupon, DiscountType } from "@/types/database";

type CouponWithStats = Coupon & {
  stats: { redeemed_count: number; used_count: number };
};

const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: "Százalékos",
  fixed: "Fix összeg",
  free_shipping: "Ingyenes szállítás",
};

function formatDiscountValue(c: Coupon): string {
  switch (c.discount_type) {
    case "percentage":
      return `${c.discount_value}%`;
    case "fixed":
      return `${c.discount_value.toLocaleString("hu-HU")} Ft`;
    case "free_shipping":
      return "—";
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CouponWithStats | null>(null);
  const [deleting, setDeleting] = useState<CouponWithStats | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadCoupons = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetchRaw<{ coupons: CouponWithStats[] }>(
        "/api/admin/coupons",
        { signal, cache: "no-store" },
      );
      if (signal?.aborted) return;
      setCoupons(body.coupons ?? []);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      void loadCoupons(ac.signal);
    });
    return () => ac.abort();
  }, [loadCoupons]);

  const handleToggleActive = async (c: CouponWithStats) => {
    // Optimistic update
    setCoupons((prev) =>
      prev.map((it) =>
        it.id === c.id ? { ...it, is_active: !it.is_active } : it,
      ),
    );
    try {
      await adminFetch(`/api/admin/coupons/${c.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !c.is_active }),
      });
    } catch (err) {
      // Roll back on failure
      setCoupons((prev) =>
        prev.map((it) =>
          it.id === c.id ? { ...it, is_active: c.is_active } : it,
        ),
      );
      setError(
        err instanceof AdminApiError ? err.message : "Frissítés sikertelen",
      );
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await adminFetch(`/api/admin/coupons/${deleting.id}`, {
        method: "DELETE",
      });
      setDeleting(null);
      await loadCoupons();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Törlés sikertelen");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-[var(--text-primary)]">
            Kuponok
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Pontboltban beváltható kuponok kezelése. A törlés itt csak
            inaktiválás — a már beváltott kódok érvényesek maradnak.
          </p>
        </div>
        <AdminButton onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Új kupon
        </AdminButton>
      </header>

      {error ? (
        <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-2 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      ) : null}

      <AdminCard>
        <AdminCardHeader>
          <div>
            <AdminCardTitle>Kuponok</AdminCardTitle>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {coupons.length} elem · klikkelj a státuszra az
              aktiválás/deaktiváláshoz.
            </p>
          </div>
        </AdminCardHeader>
        <AdminTableContainer className="rounded-none border-0 border-t border-[var(--glass-border)]">
          <AdminTable>
            <AdminTHead>
              <tr className="border-b border-[var(--glass-border)]">
                <AdminTH>Név</AdminTH>
                <AdminTH>Típus</AdminTH>
                <AdminTH className="text-right">Érték</AdminTH>
                <AdminTH className="text-right">Pontár</AdminTH>
                <AdminTH className="text-right">Beváltások</AdminTH>
                <AdminTH>Státusz</AdminTH>
                <AdminTH className="text-right">Művelet</AdminTH>
              </tr>
            </AdminTHead>
            {loading ? (
              <AdminTableSkeleton columns={7} rows={5} />
            ) : coupons.length === 0 ? (
              <AdminTBody>
                <tr>
                  <td colSpan={7}>
                    <AdminTableEmpty
                      icon={<Ticket className="h-5 w-5" />}
                      title="Még nincs kupon"
                      description="Hozz létre egy kupont, hogy a felhasználók pontjaikért beválthassák."
                    />
                  </td>
                </tr>
              </AdminTBody>
            ) : (
              <AdminTBody>
                {coupons.map((c) => (
                  <AdminTR key={c.id}>
                    <AdminTD>
                      <div className="font-medium">{c.name}</div>
                      {c.description ? (
                        <div className="max-w-[32ch] truncate text-xs text-[var(--text-muted)]">
                          {c.description}
                        </div>
                      ) : null}
                    </AdminTD>
                    <AdminTD>
                      <AdminBadge tone="info">
                        {DISCOUNT_TYPE_LABELS[c.discount_type]}
                      </AdminBadge>
                    </AdminTD>
                    <AdminTD className="text-right tabular-nums">
                      {formatDiscountValue(c)}
                    </AdminTD>
                    <AdminTD className="text-right tabular-nums">
                      {c.point_cost} pt
                    </AdminTD>
                    <AdminTD className="text-right tabular-nums text-[var(--text-secondary)]">
                      {c.stats.used_count} / {c.stats.redeemed_count}
                    </AdminTD>
                    <AdminTD>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(c)}
                        className="cursor-pointer"
                        aria-label={
                          c.is_active ? "Deaktiválás" : "Aktiválás"
                        }
                      >
                        <AdminBadge tone={c.is_active ? "gold" : "neutral"}>
                          {c.is_active ? "Aktív" : "Inaktív"}
                        </AdminBadge>
                      </button>
                    </AdminTD>
                    <AdminTD className="text-right">
                      <div className="flex justify-end gap-1">
                        <AdminButton
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditing(c)}
                          aria-label="Szerkesztés"
                        >
                          <Pencil className="h-4 w-4" />
                        </AdminButton>
                        <AdminButton
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(c)}
                          aria-label="Törlés"
                          className="text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 hover:text-[var(--accent-red)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </AdminButton>
                      </div>
                    </AdminTD>
                  </AdminTR>
                ))}
              </AdminTBody>
            )}
          </AdminTable>
        </AdminTableContainer>
      </AdminCard>

      {creating ? (
        <CouponFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await loadCoupons();
          }}
        />
      ) : null}
      {editing ? (
        <CouponFormDialog
          mode="edit"
          coupon={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadCoupons();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Kupon inaktiválása"
        description={
          deleting
            ? `A „${deleting.name}” kupon inaktiválódik. A már beváltott kódok érvényesek maradnak.`
            : ""
        }
        confirmLabel="Inaktiválás"
        loading={deleteBusy}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coupon form (create / edit)
// ---------------------------------------------------------------------------

interface CouponFormProps {
  mode: "create" | "edit";
  coupon?: CouponWithStats;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function CouponFormDialog({
  mode,
  coupon,
  onClose,
  onSaved,
}: CouponFormProps) {
  const [name, setName] = useState(coupon?.name ?? "");
  const [description, setDescription] = useState(coupon?.description ?? "");
  const [discountType, setDiscountType] = useState<DiscountType>(
    coupon?.discount_type ?? "percentage",
  );
  const [discountValue, setDiscountValue] = useState<string>(
    coupon ? String(coupon.discount_value) : "",
  );
  const [pointCost, setPointCost] = useState<string>(
    coupon ? String(coupon.point_cost) : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("A név kötelező");
      return;
    }

    const parsedDiscountValue =
      discountType === "free_shipping" ? 0 : Number.parseFloat(discountValue);
    const parsedPointCost = Number.parseInt(pointCost, 10);

    if (
      discountType !== "free_shipping" &&
      (Number.isNaN(parsedDiscountValue) || parsedDiscountValue < 0)
    ) {
      setError("Az érték nemnegatív szám kell legyen");
      return;
    }
    if (discountType === "percentage" && parsedDiscountValue > 100) {
      setError("A százalékos kedvezmény értéke nem lehet 100 felett");
      return;
    }
    if (!Number.isInteger(parsedPointCost) || parsedPointCost < 0) {
      setError("A pontár nemnegatív egész szám kell legyen");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      discount_type: discountType,
      discount_value: parsedDiscountValue,
      point_cost: parsedPointCost,
    };

    try {
      if (mode === "create") {
        await adminFetch("/api/admin/coupons", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else if (coupon) {
        await adminFetch(`/api/admin/coupons/${coupon.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDialogRoot open onOpenChange={(next) => (next ? null : onClose())}>
      <AdminDialogContent open size="md">
        <AdminDialogHeader>
          <AdminDialogTitle>
            {mode === "create" ? "Új kupon" : "Kupon szerkesztése"}
          </AdminDialogTitle>
          <AdminDialogDescription>
            Add meg a kupon adatait. A felhasználók a Pontboltból válthatják be.
          </AdminDialogDescription>
        </AdminDialogHeader>
        <form onSubmit={handleSubmit}>
          <AdminDialogBody className="space-y-4">
            <AdminField label="Név" htmlFor="coupon-name">
              <AdminInput
                id="coupon-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </AdminField>
            <AdminField label="Leírás (opcionális)" htmlFor="coupon-desc">
              <AdminTextarea
                id="coupon-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </AdminField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AdminField label="Kedvezmény típusa" htmlFor="discount-type">
                <AdminSelect
                  id="discount-type"
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as DiscountType)
                  }
                >
                  <option value="percentage">Százalékos</option>
                  <option value="fixed">Fix összeg</option>
                  <option value="free_shipping">Ingyenes szállítás</option>
                </AdminSelect>
              </AdminField>
              {discountType !== "free_shipping" ? (
                <AdminField
                  label={
                    discountType === "percentage"
                      ? "Százalék (%)"
                      : "Összeg (Ft)"
                  }
                  htmlFor="discount-value"
                >
                  <AdminInput
                    id="discount-value"
                    type="number"
                    min={0}
                    max={discountType === "percentage" ? 100 : undefined}
                    step={discountType === "percentage" ? 1 : 100}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </AdminField>
              ) : null}
              <AdminField
                label="Pontár"
                htmlFor="point-cost"
                className="sm:col-span-2"
              >
                <AdminInput
                  id="point-cost"
                  type="number"
                  min={0}
                  step={1}
                  value={pointCost}
                  onChange={(e) => setPointCost(e.target.value)}
                  required
                />
              </AdminField>
            </div>
            {error ? (
              <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
                {error}
              </div>
            ) : null}
          </AdminDialogBody>
          <AdminDialogFooter>
            <AdminButton
              type="button"
              variant="subtle"
              onClick={onClose}
              disabled={submitting}
            >
              Mégse
            </AdminButton>
            <AdminButton type="submit" loading={submitting}>
              {mode === "create" ? "Létrehozás" : "Mentés"}
            </AdminButton>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}
