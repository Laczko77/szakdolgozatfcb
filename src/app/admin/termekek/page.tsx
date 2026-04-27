"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Plus, Search } from "lucide-react";
import type { Product, ProductVariant } from "@/types/database";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
} from "@/components/admin/AdminCard";
import { AdminInput } from "@/components/admin/AdminInput";
import {
  AdminTableContainer,
  AdminTableEmpty,
  AdminTableSkeleton,
} from "@/components/admin/AdminTable";
import { Pagination } from "@/components/admin/Pagination";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  ProductEditor,
} from "@/components/admin/products/ProductEditor";
import {
  ProductsTable,
  type ProductRow,
} from "@/components/admin/products/ProductsTable";

const PAGE_SIZE = 20;

interface ProductListResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

interface ProductDetailResponse {
  product: Product;
  variants: ProductVariant[];
}

async function fetchProducts(
  page: number,
  search: string,
  signal: AbortSignal,
): Promise<ProductListResponse> {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(PAGE_SIZE));
  if (search.trim()) params.set("search", search.trim());

  const response = await fetch(`/api/products?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Termékek lekérése sikertelen");
  }
  return (await response.json()) as ProductListResponse;
}

async function fetchVariantsForProducts(
  products: Product[],
  signal: AbortSignal,
): Promise<Map<string, ProductVariant[]>> {
  const results = await Promise.all(
    products.map(async (p) => {
      const response = await fetch(`/api/products/${p.id}`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok) return [p.id, [] as ProductVariant[]] as const;
      const json = (await response.json()) as ProductDetailResponse;
      return [p.id, json.variants] as const;
    }),
  );
  return new Map(results);
}

export default function AdminProductsPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchProducts(page, search, signal);
        const variants = await fetchVariantsForProducts(list.products, signal);
        if (signal.aborted) return;
        setRows(
          list.products.map((p) => ({
            product: p,
            variants: variants.get(p.id) ?? [],
          })),
        );
        setTotal(list.total);
        setTotalPages(list.totalPages);
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "Hiba a betöltés során");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, search],
  );

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      void load(ac.signal);
    });
    return () => ac.abort();
  }, [load]);

  // Debounced search
  useEffect(() => {
    const id = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const reload = useCallback(() => {
    const ac = new AbortController();
    void load(ac.signal);
  }, [load]);

  function handleNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  async function handleStockSave(variantId: string, stock: number) {
    // Find the parent product so we know the URL.
    const row = rows.find((r) => r.variants.some((v) => v.id === variantId));
    if (!row) return;

    const response = await fetch(
      `/api/admin/products/${row.product.id}/variants`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variants: [{ id: variantId, stock }],
        }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(body.error ?? "Készlet frissítése sikertelen");
    }

    // Optimistic local refresh — patch the row in place.
    setRows((current) =>
      current.map((r) =>
        r.product.id === row.product.id
          ? {
              ...r,
              variants: r.variants.map((v) =>
                v.id === variantId ? { ...v, stock } : v,
              ),
            }
          : r,
      ),
    );
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/products/${deleteTarget.product.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Törlés sikertelen");
      }
      setDeleteTarget(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Törlés sikertelen");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-gold)]">
            Kereskedelem
          </p>
          <h1 className="font-display text-3xl uppercase tracking-[0.04em] text-[var(--text-primary)] md:text-4xl">
            Termékek
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {total} termék · készlet inline szerkesztéssel.
          </p>
        </div>
        <AdminButton onClick={handleNew}>
          <Plus className="h-4 w-4" />
          Új termék
        </AdminButton>
      </header>

      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Lista</AdminCardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <AdminInput
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Keresés név vagy leírás alapján…"
              className="pl-9"
            />
          </div>
        </AdminCardHeader>

        <AdminTableContainer className="rounded-none border-x-0 border-b-0">
          {loading ? (
            <table className="w-full border-collapse text-sm">
              <AdminTableSkeleton columns={5} rows={6} />
            </table>
          ) : error ? (
            <AdminTableEmpty
              icon={<Package className="h-5 w-5" />}
              title="Hiba történt"
              description={error}
              action={
                <AdminButton variant="secondary" onClick={reload}>
                  Újra
                </AdminButton>
              }
            />
          ) : rows.length === 0 ? (
            <AdminTableEmpty
              icon={<Package className="h-5 w-5" />}
              title="Nincs termék"
              description={
                search
                  ? "A keresés nem hozott találatot."
                  : "Hozz létre egy újat a jobb felső gombbal."
              }
              action={
                !search ? (
                  <AdminButton variant="secondary" onClick={handleNew}>
                    <Plus className="h-4 w-4" />
                    Új termék
                  </AdminButton>
                ) : undefined
              }
            />
          ) : (
            <ProductsTable
              rows={rows}
              onEdit={(r) => {
                setEditing(r);
                setEditorOpen(true);
              }}
              onDelete={(r) => setDeleteTarget(r)}
              onStockSave={handleStockSave}
            />
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

      <ProductEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        product={editing?.product ?? null}
        initialVariants={editing?.variants ?? []}
        onSaved={reload}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Termék törlése"
        description={
          <>
            Biztosan törölni szeretnéd a(z){" "}
            <strong className="text-[var(--text-primary)]">
              {deleteTarget?.product.name}
            </strong>{" "}
            terméket? A művelet nem visszafordítható, és a hozzá tartozó
            variánsokat is törli. Ha a termék már szerepel rendelésben,
            a szerver megtagadja a törlést.
          </>
        }
        confirmLabel="Törlés"
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
