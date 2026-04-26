import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/types/database";
import {
  ARTICLE_CATEGORY_LABELS,
  isArticleCategory,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RelatedArticlesProps {
  articles: Article[];
}

/**
 * "Tovább olvasnál?" rail rendered at the bottom of the article view.
 *
 * Server-rendered (no Framer Motion) — these cards live below the fold
 * and shouldn't pay the JS cost of viewport-triggered animations.  A
 * subtle CSS hover scale keeps them alive without bundling Motion.
 */
export function RelatedArticles({ articles }: RelatedArticlesProps) {
  if (articles.length === 0) return null;

  return (
    <section
      aria-labelledby="related-articles-heading"
      className="mt-20 border-t border-[var(--glass-border)] pt-12"
    >
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
            Tovább olvasnál
          </p>
          <h2
            id="related-articles-heading"
            className="mt-2 font-display text-3xl tracking-wider text-[var(--text-primary)] sm:text-4xl"
          >
            Kapcsolódó hírek
          </h2>
        </div>
        <Link
          href="/hirek"
          className="hidden text-sm text-[var(--text-secondary)] underline-offset-4 hover:text-[var(--accent-gold)] hover:underline sm:inline"
        >
          Összes hír →
        </Link>
      </div>

      <ul className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-3">
        {articles.map((a) => {
          const categoryLabel =
            a.category && isArticleCategory(a.category)
              ? ARTICLE_CATEGORY_LABELS[a.category]
              : a.category;

          return (
            <li key={a.id} className="group h-full">
              <Link
                href={`/hirek/${a.id}`}
                className={cn(
                  "glass-card glass-card-hover",
                  "flex h-full flex-col overflow-hidden",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                )}
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-secondary)]">
                  {a.image_url ? (
                    <Image
                      src={a.image_url}
                      alt={a.title}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <span className="font-display text-2xl tracking-wider text-[var(--accent-gold)] opacity-40">
                        FCB
                      </span>
                    </div>
                  )}

                  {categoryLabel && (
                    <span
                      className={cn(
                        "absolute left-3 top-3",
                        "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                        "border border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] backdrop-blur-md",
                        "text-[var(--accent-gold)]",
                      )}
                    >
                      {categoryLabel}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3
                    className={cn(
                      "font-display text-lg leading-tight tracking-wide line-clamp-2",
                      "text-[var(--text-primary)] transition-colors duration-300",
                      "group-hover:text-[var(--accent-gold)]",
                    )}
                  >
                    {a.title}
                  </h3>
                  <time
                    dateTime={a.created_at}
                    className="mt-auto text-xs text-[var(--text-muted)]"
                  >
                    {formatDate(a.created_at)}
                  </time>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
