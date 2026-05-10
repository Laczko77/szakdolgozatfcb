"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { motion } from "framer-motion";
import {
  fetchProducts,
  PRODUCT_SORT_KEYS,
  type ProductSortKey,
  type ProductWithRating,
} from "@/lib/shop-api";
import { useToast } from "@/providers/ToastProvider";
import { CategoryFilter, type CategoryOption } from "@/components/shop/CategoryFilter";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { ProductGridSkeleton } from "@/components/shop/ProductCardSkeleton";
import { PopularProducts } from "@/components/shop/PopularProducts";
import { SortSelect } from "@/components/shop/SortSelect";
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

function isSortKey(value: string | null): value is ProductSortKey {
  return value !== null && (PRODUCT_SORT_KEYS as readonly string[]).includes(value);
}

/**
 * Next.js requires `useSearchParams` to be inside a Suspense boundary for
 * static / streaming compatibility — the inner component holds the actual
 * page so the outer default export can wrap it.
 */
export default function ShopPage() {
  return (
    <Suspense fallback={<ShopPageFallback />}>
      <ShopPageInner />
    </Suspense>
  );
}

function ShopPageFallback() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-14 w-3/4 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
      <ProductGridSkeleton />
    </div>
  );
}

function ShopPageInner() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<ProductWithRating[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [topProductIds, setTopProductIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");

  // URL-driven sort state (F28). The query string is the source of truth so
  // the sort survives reloads + share-links; we only ever push when it
  // actually changes via the dropdown.
  const sortFromUrl = searchParams.get("sort");
  const sort: ProductSortKey = isSortKey(sortFromUrl) ? sortFromUrl : "newest";

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
          sort,
        });
        setProducts((prev) =>
          append ? [...prev, ...data.products] : data.products,
        );
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        // top_products is global (independent of pagination/filter), so we
        // accept whatever the API last reported — it stays valid even after
        // a "Load more" appends to the current page.
        setTopProductIds(data.top_products ?? []);

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
    [category, debouncedSearch, sort, toast],
  );

  // Reload from page 1 when filters change.
  useEffect(() => {
    (async () => {
      await loadPage(1, false);
    })();
  }, [loadPage]);

  const handleSortChange = useCallback(
    (next: ProductSortKey) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "newest") params.delete("sort");
      else params.set("sort", next);
      const qs = params.toString();
      // replace, not push — sort changes are filter-like and shouldn't
      // pollute the back-stack with intermediate states.
      router.replace(qs ? `/shop?${qs}` : "/shop", { scroll: false });
    },
    [router, searchParams],
  );

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
        <p className="font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
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

      {/* Data-driven recommendation rail — F14.3. Self-hides when
          there is not enough engagement data yet. */}
      <PopularProducts />

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className={cn(
              "relative w-full sm:max-w-md",
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

          <SortSelect value={sort} onChange={handleSortChange} />
        </div>

        <CategoryFilter
          options={categoryOptions}
          active={category}
          onChange={setCategory}
        />
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
          <ProductGrid products={products} topProductIds={topProductIds} />

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
