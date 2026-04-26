"use client";

import { Newspaper } from "lucide-react";
import { ARTICLE_CATEGORY_LABELS, type ArticleCategory } from "@/lib/constants";

interface NewsEmptyStateProps {
  category: ArticleCategory | "";
  onResetFilter: () => void;
}

/**
 * Friendly empty state for the news listing.
 *
 * Two variants — "no articles at all" vs "nothing in this filter".
 * The filter case offers a one-click reset back to "Mind".
 */
export function NewsEmptyState({
  category,
  onResetFilter,
}: NewsEmptyStateProps) {
  const hasFilter = category !== "";

  return (
    <div className="glass-card flex flex-col items-center gap-5 px-6 py-16 text-center">
      <div
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full border border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] text-[var(--accent-gold)]"
      >
        <Newspaper size={26} />
      </div>

      <p className="font-display text-3xl tracking-wider text-[var(--text-primary)]">
        {hasFilter ? "Üres polc ebben a kategóriában" : "Még nem érkeztek hírek"}
      </p>

      <p className="max-w-md text-sm text-[var(--text-secondary)]">
        {hasFilter
          ? `A "${ARTICLE_CATEGORY_LABELS[category as ArticleCategory]}" rovat egyelőre üres. Nézz vissza később, vagy böngéssz az összes hír között.`
          : "Az adminisztrátorok hamarosan tartalommal töltik fel a portált. Térj vissza később!"}
      </p>

      {hasFilter && (
        <button
          type="button"
          onClick={onResetFilter}
          className="glass-button-secondary mt-2"
        >
          Összes hír megtekintése
        </button>
      )}
    </div>
  );
}
