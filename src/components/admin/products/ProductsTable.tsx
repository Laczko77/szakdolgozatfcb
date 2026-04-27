"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import type { Product, ProductVariant } from "@/types/database";
import { formatPrice } from "@/lib/format";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminButton } from "@/components/admin/AdminButton";
import { AdminInput } from "@/components/admin/AdminInput";
import {
  AdminTable,
  AdminTBody,
  AdminTD,
  AdminTH,
  AdminTHead,
  AdminTR,
} from "@/components/admin/AdminTable";

export interface ProductRow {
  product: Product;
  variants: ProductVariant[];
}

interface ProductsTableProps {
  rows: ProductRow[];
  onEdit: (row: ProductRow) => void;
  onDelete: (row: ProductRow) => void;
  /** Inline-stock edit handler. Receives the variant id and the new stock count. */
  onStockSave: (variantId: string, stock: number) => Promise<void>;
}

export function ProductsTable({
  rows,
  onEdit,
  onDelete,
  onStockSave,
}: ProductsTableProps) {
  return (
    <AdminTable>
      <AdminTHead>
        <tr>
          <AdminTH className="w-[36%]">Termék</AdminTH>
          <AdminTH className="w-[14%]">Kategória</AdminTH>
          <AdminTH className="w-[12%]">Ár</AdminTH>
          <AdminTH className="w-[26%]">Készlet (variánsok)</AdminTH>
          <AdminTH className="w-[12%] text-right">Műveletek</AdminTH>
        </tr>
      </AdminTHead>
      <AdminTBody>
        {rows.map((row) => (
          <AdminTR key={row.product.id}>
            <AdminTD>
              <div className="flex items-center gap-3">
                {row.product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.product.image_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded bg-[var(--bg-tertiary)]/40" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--text-primary)]">
                    {row.product.name}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {row.product.id.slice(0, 8)}
                  </p>
                </div>
              </div>
            </AdminTD>

            <AdminTD>
              {row.product.category ? (
                <AdminBadge tone="neutral">{row.product.category}</AdminBadge>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">—</span>
              )}
            </AdminTD>

            <AdminTD>
              <span className="font-mono text-sm tabular-nums text-[var(--text-primary)]">
                {formatPrice(row.product.price)}
              </span>
            </AdminTD>

            <AdminTD>
              <VariantStockList
                variants={row.variants}
                onSave={onStockSave}
              />
            </AdminTD>

            <AdminTD className="text-right">
              <div className="inline-flex items-center gap-1.5">
                <AdminButton
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(row)}
                  aria-label={`Szerkesztés: ${row.product.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(row)}
                  aria-label={`Törlés: ${row.product.name}`}
                  className="text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10"
                >
                  <Trash2 className="h-4 w-4" />
                </AdminButton>
              </div>
            </AdminTD>
          </AdminTR>
        ))}
      </AdminTBody>
    </AdminTable>
  );
}

interface VariantStockListProps {
  variants: ProductVariant[];
  onSave: (variantId: string, stock: number) => Promise<void>;
}

function VariantStockList({ variants, onSave }: VariantStockListProps) {
  if (variants.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">Nincs variáns</span>;
  }

  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <AdminBadge tone={totalStock === 0 ? "danger" : totalStock < 10 ? "warning" : "success"}>
          Σ {totalStock}
        </AdminBadge>
        {variants.slice(0, 4).map((v) => (
          <InlineVariantStock key={v.id} variant={v} onSave={onSave} />
        ))}
        {variants.length > 4 ? (
          <span className="text-xs text-[var(--text-muted)]">
            +{variants.length - 4}
          </span>
        ) : null}
      </div>
    </div>
  );
}

interface InlineVariantStockProps {
  variant: ProductVariant;
  onSave: (variantId: string, stock: number) => Promise<void>;
}

function InlineVariantStock({ variant, onSave }: InlineVariantStockProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | "">(variant.stock);
  const [saving, setSaving] = useState(false);

  const label = [variant.size, variant.color].filter(Boolean).join(" / ") || "—";

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(variant.stock);
          setEditing(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-gold)]/40 hover:text-[var(--text-primary)]"
        aria-label={`Készlet szerkesztése: ${label}`}
        title={`${label} · ${variant.stock} db`}
      >
        <span className="opacity-70">{label}</span>
        <span className="font-mono tabular-nums">{variant.stock}</span>
      </button>
    );
  }

  async function commit() {
    if (draft === "" || (typeof draft === "number" && draft < 0)) {
      setEditing(false);
      return;
    }
    if (draft === variant.stock) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(variant.id, typeof draft === "number" ? draft : 0);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/5 px-1.5 py-0.5">
      <span className="text-[11px] text-[var(--text-secondary)]">{label}</span>
      <AdminInput
        type="number"
        min={0}
        step={1}
        value={draft === "" ? "" : draft}
        autoFocus
        disabled={saving}
        onChange={(e) =>
          setDraft(
            e.target.value === ""
              ? ""
              : Math.max(0, Number.parseInt(e.target.value, 10) || 0),
          )
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void commit();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="h-6 w-14 px-1.5 py-0 text-[11px]"
      />
      <button
        type="button"
        onClick={() => void commit()}
        disabled={saving}
        className="text-[var(--accent-gold)] hover:opacity-80 disabled:opacity-40"
        aria-label="Mentés"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        disabled={saving}
        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
        aria-label="Mégse"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
