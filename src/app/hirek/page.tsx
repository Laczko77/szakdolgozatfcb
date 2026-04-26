"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Article } from "@/types/database";
import {
  ARTICLE_CATEGORIES,
  isArticleCategory,
  type ArticleCategory,
} from "@/lib/constants";
import { fetchArticles } from "@/lib/articles-api";
import { useToast } from "@/providers/ToastProvider";
import { CategoryPills, type CategoryValue } from "@/components/news/CategoryPills";
import { HeroArticle } from "@/components/news/HeroArticle";
import { ArticleCard } from "@/components/news/ArticleCard";
import {
  ArticleGridSkeleton,
  HeroArticleSkeleton,
} from "@/components/news/ArticleCardSkeleton";
import { NewsEmptyState } from "@/components/news/NewsEmptyState";
import { cn } from "@/lib/utils";

/**
 * /hirek — public news listing.
 *
 * Behaviour:
 *  - First page (12 items) is fetched on mount and on every category change.
 *  - The newest article (always page=1, index=0) renders as the hero;
 *    everything else fills the grid below.
 *  - Category state is mirrored into the URL via `?category=...` so links
 *    are shareable and back-button friendly.
 *  - "Több cikk" loads the next page; we append rather than replace so
 *    scroll position is preserved.
 *
 * The page header sits above the filter — it's the only place where the
 * Bebas Neue display font runs at 6xl, establishing this as a content
 * destination, not a chrome page.
 */

const PAGE_SIZE = 12;

function HirekPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const initialCategory = readCategoryFromQuery(searchParams.get("category"));

  const [category, setCategory] = useState<CategoryValue>(initialCategory);
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadPage = useCallback(
    async (pageNumber: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const data = await fetchArticles({
          page: pageNumber,
          limit: PAGE_SIZE,
          category: category || undefined,
        });
        setArticles((prev) =>
          append ? [...prev, ...data.articles] : data.articles,
        );
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Hírek betöltése sikertelen",
        );
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [category, toast],
  );

  // Fetch first page on mount + whenever the category changes.
  // The async IIFE defers the setLoading(true) inside loadPage to a
  // microtask — `react-hooks/set-state-in-effect` flags any sync state
  // mutation inside an effect body.
  useEffect(() => {
    void (async () => {
      await loadPage(1, false);
    })();
  }, [loadPage]);

  // Keep the URL in sync with the active filter without nuking the history.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (category) params.set("category", category);
    else params.delete("category");

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(`/hirek${next ? `?${next}` : ""}`, { scroll: false });
    }
    // We intentionally only react to category changes — searchParams is
    // updated by router.replace, which would otherwise feedback-loop here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const heroArticle = articles[0];
  const restArticles = useMemo(() => articles.slice(1), [articles]);
  const showLoadMore = page < totalPages && !loading;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Page header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 sm:mb-12"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Hírek
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-5xl sm:text-7xl lg:text-[5.5rem]",
          )}
        >
          A legfrissebb a klubról
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          Átigazolások, meccsösszefoglalók, interjúk és vélemények — minden,
          ami a blaugrana világában történik. Frissítve, mire a meccs
          lefújtak után felállsz a foteledből.
        </p>
      </motion.header>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        className="mb-8 sm:mb-10"
      >
        <CategoryPills
          active={category}
          onChange={(value) => {
            // Reset list state when a new filter is selected — this is what
            // triggers the loadPage effect via `category` dependency.
            setCategory(value);
            setArticles([]);
            setPage(1);
            setTotalPages(0);
          }}
        />
      </motion.div>

      {/* Result meta */}
      {!loading && (
        <p className="mb-6 text-sm text-[var(--text-secondary)]" aria-live="polite">
          {total === 0
            ? "Nincs találat ebben a rovatban."
            : category
              ? `${total} cikk a kiválasztott rovatban`
              : `${total} cikk összesen`}
        </p>
      )}

      {/* Hero + grid — wrapped in AnimatePresence so a category switch
          smoothly fades the previous results out before the next render. */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-10"
          >
            <HeroArticleSkeleton />
            <ArticleGridSkeleton count={6} />
          </motion.div>
        ) : articles.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <NewsEmptyState
              category={category}
              onResetFilter={() => {
                setCategory("");
                setArticles([]);
                setPage(1);
                setTotalPages(0);
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key={`results-${category || "all"}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-10 sm:space-y-12"
          >
            {heroArticle && <HeroArticle article={heroArticle} />}

            {restArticles.length > 0 && (
              <ul
                className={cn(
                  "grid gap-5 sm:gap-6",
                  "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
                )}
              >
                {restArticles.map((article, idx) => (
                  <ArticleCard key={article.id} article={article} index={idx} />
                ))}
              </ul>
            )}

            {showLoadMore && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => void loadPage(page + 1, true)}
                  disabled={loadingMore}
                  className="glass-button-secondary"
                >
                  {loadingMore ? "Betöltés…" : "Több cikk"}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Validate the URL ?category param against the canonical enum. */
function readCategoryFromQuery(raw: string | null): CategoryValue {
  if (!raw) return "";
  return isArticleCategory(raw) ? (raw as ArticleCategory) : "";
}

/**
 * Next.js requires `useSearchParams` to be inside a Suspense boundary
 * for static / streaming compatibility — wrap the page accordingly.
 */
export default function HirekPage() {
  return (
    <Suspense fallback={<HirekFallback />}>
      <HirekPageInner />
    </Suspense>
  );
}

function HirekFallback() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mb-10 space-y-3">
        <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-16 w-3/4 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
      {/* Pre-render the category pills shape so the layout doesn't jump. */}
      <div className="mb-10 flex gap-2">
        {Array.from({ length: ARTICLE_CATEGORIES.length + 1 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-24 animate-pulse rounded-full bg-[var(--glass-bg-hover)]"
          />
        ))}
      </div>
      <HeroArticleSkeleton />
      <div className="mt-10">
        <ArticleGridSkeleton count={6} />
      </div>
    </div>
  );
}
