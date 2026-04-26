"use client";

import type { Review } from "@/types/database";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RatingStars } from "./RatingStars";

interface ReviewListProps {
  reviews: Review[];
  /** Optional pre-fetched username/avatar map keyed by user_id. */
  authors?: Record<string, { username: string | null; avatarUrl: string | null }>;
}

/**
 * Renders the read-only review list shown beneath the product detail.
 *
 * The reviews API does not currently join the profiles table, so the page
 * passes an `authors` map (or omits it for anonymous-style display).  For
 * now we render an "FCB" placeholder avatar when no author data is
 * available — keeps the list visually balanced.
 */
export function ReviewList({ reviews, authors }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div
        className={cn(
          "glass-card flex flex-col items-center gap-2 px-6 py-10 text-center",
        )}
      >
        <p className="font-display text-lg tracking-wider text-[var(--text-primary)]">
          Még nincs értékelés
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          Légy az első, aki megosztja a véleményét erről a termékről!
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((review) => {
        const author = authors?.[review.user_id];
        const initials = (author?.username ?? "F").slice(0, 1).toUpperCase();
        return (
          <li
            key={review.id}
            className={cn("glass-card p-4 sm:p-5")}
          >
            <div className="mb-3 flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                  "border border-[var(--glass-border)] bg-[var(--bg-secondary)]",
                  "font-display text-base text-[var(--accent-gold)]",
                )}
                aria-hidden
              >
                {initials}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-display text-sm tracking-wide text-[var(--text-primary)]">
                  {author?.username ?? "Szurkoló"}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {formatDate(review.created_at)}
                </span>
              </div>
              <RatingStars value={review.rating} size={14} />
            </div>
            {review.comment && (
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {review.comment}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
