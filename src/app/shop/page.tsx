"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { motion } from "framer-motion";
import type { Product } from "@/types/database";
import { fetchProducts } from "@/lib/shop-api";
import { useToast } from "@/providers/ToastProvider";
import { CategoryFilter, type CategoryOption } from "@/components/shop/CategoryFilter";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { ProductGridSkeleton } from "@/components/shop/ProductCardSkeleton";
import { cn } from "@/lib/utils";

/**
 * Storefront listing page (/shop).
 *
 * Filters on the client by category + search; the API supports both via
 * query parameters, so each filter change triggers a fresh fetch from
 * page 1.  We do not attempt infinite scroll on this iteration —
 * pagination is handled by a "Load more" button at the bottom.
 *
 * The category list is derived from whatever categories the loaded
 * products report; rather than hard-coding a list, we fold them into a
 * Set on first load so admin-side category changes flow through without
 * a frontend deploy.
 */

const PAGE_SIZE = 12;
// Common FCB merch categories — used as a friendly default ordering
// hint, but the actual options always come from real product data.
const KNOWN_CATEGORY_LABELS: Record<string, string> = {
  jersey: "Mez",
  scarf: "Sál",
  cap: "Sapka",
  accessory: "Kiegészítő",
  fan: "Szurkolói",
  collectible: "Gyűjtői",
};

export default function ShopPage() {
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");

  const [knownCategories, setKnownCategories] = useState<Set<string>>(
    new Set(),
  );

  // Debounce search by 300ms — keeps the API responsive without spamming.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadPage = useCallback(
    async (pageNumber: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const data = await fetchProducts({
          page: pageNumber,
          limit: PAGE_SIZE,
          category: category || undefined,
          search: debouncedSearch || undefined,
        });
        setProducts((prev) =>
          append ? [...prev, ...data.products] : data.products,
        );
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotal(data.total);

        // Fold any new categories we encounter into the known set —
        // these populate the filter pills.
        if (!append && data.products.length > 0) {
          setKnownCategories((prev) => {
            const next = new Set(prev);
            for (const p of data.products) {
              if (p.category) next.add(p.category);
            }
            return next;
          });
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Termékek betöltése sikertelen",
        );
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [category, debouncedSearch, toast],
  );

  // Reload from page 1 when filters change.
  useEffect(() => {
    (async () => {
      await loadPage(1, false);
    })();
  }, [loadPage]);

  const categoryOptions: CategoryOption[] = useMemo(() => {
    const opts: CategoryOption[] = [{ value: "", label: "Mind" }];
    for (const cat of knownCategories) {
      opts.push({
        value: cat,
        label: KNOWN_CATEGORY_LABELS[cat] ?? cat,
      });
    }
    return opts;
  }, [knownCategories]);

  const showLoadMore = page < totalPages && !loading;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Hero / page header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 sm:mb-10"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça Shop
        </p>
        <h1 className="mt-2 font-display text-4xl leading-none tracking-wider text-[var(--text-primary)] sm:text-6xl">
          Hivatalos szurkolói áruház
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--text-secondary)] sm:text-base">
          Mezek, sálak, kiegészítők — minden, amit egy igazi blaugrana magával
          visz a meccsre. Válogass kedvedre a kollekcióból.
        </p>
      </motion.header>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className={cn(
            "relative w-full max-w-md",
            "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md",
            "transition-colors",
            "focus-within:border-[var(--accent-gold)]",
          )}
        >
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés termékek között…"
            className={cn(
              "w-full rounded-full bg-transparent py-2.5 pl-10 pr-10 text-sm",
              "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "focus:outline-none",
            )}
            aria-label="Termékek keresése"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Keresés törlése"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 sm:max-w-[60%]">
          <CategoryFilter
            options={categoryOptions}
            active={category}
            onChange={setCategory}
          />
        </div>
      </div>

      {/* Result count */}
      {!loading && (
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          {total === 0
            ? "Nincs találat a megadott szűrőkre."
            : `${total} termék ${
                category || debouncedSearch ? "a szűrésben" : "összesen"
              }`}
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <ProductGridSkeleton />
      ) : products.length === 0 ? (
        <EmptyState
          onReset={() => {
            setSearch("");
            setCategory("");
          }}
          hasActiveFilter={Boolean(category || debouncedSearch)}
        />
      ) : (
        <>
          <ProductGrid products={products} />

          {showLoadMore && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => loadPage(page + 1, true)}
                disabled={loadingMore}
                className="glass-button-secondary"
              >
                {loadingMore ? "Betöltés…" : "Több termék"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({
  onReset,
  hasActiveFilter,
}: {
  onReset: () => void;
  hasActiveFilter: boolean;
}) {
  return (
    <div className="glass-card flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="font-display text-6xl tracking-wider text-[var(--accent-gold)] opacity-60">
        ?
      </div>
      <p className="font-display text-2xl tracking-wider text-[var(--text-primary)]">
        {hasActiveFilter ? "Üres találat" : "Még nincsenek termékek"}
      </p>
      <p className="max-w-md text-sm text-[var(--text-secondary)]">
        {hasActiveFilter
          ? "Próbálkozz más kereséssel vagy kategóriával — biztos van itt valami, ami tetszik."
          : "Az adminisztrátorok hamarosan feltöltik a kollekciót. Térj vissza később!"}
      </p>
      {hasActiveFilter && (
        <button
          type="button"
          onClick={onReset}
          className="glass-button-secondary mt-2"
        >
          Szűrők törlése
        </button>
      )}
    </div>
  );
}
