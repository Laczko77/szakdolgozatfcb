"use client";

import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/types/database";
import {
  ARTICLE_CATEGORY_LABELS,
  isArticleCategory,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WidgetShell } from "./WidgetShell";

interface LatestNewsWidgetProps {
  articles: Article[];
  index?: number;
  className?: string;
}

/**
 * "Legfrissebb hírek" widget — three compact rows, each linking to a
 * full article page. Differs from the public news listing in that we
 * use a horizontal layout (thumb on the left, copy on the right) so
 * the widget stays dense on a dashboard with limited vertical real
 * estate.
 *
 * Each row is the link target — no separate "Olvasás" affordance, the
 * cursor is enough.
 */
export function LatestNewsWidget({
  articles,
  index = 0,
  className,
}: LatestNewsWidgetProps) {
  const hasArticles = articles.length > 0;

  return (
    <WidgetShell
      eyebrow="Hírek"
      title="Legfrissebb"
      cta={{ label: "Összes hír", href: "/hirek" }}
      index={index}
      className={className}
    >
      {hasArticles ? (
        <ul className="space-y-3">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </ul>
      ) : (
        <p
          className={cn(
            "rounded-[var(--radius-md)] border border-dashed border-[var(--glass-border)]",
            "bg-[var(--glass-bg)] px-4 py-6 text-center text-sm",
            "text-[var(--text-secondary)]",
          )}
        >
          Még nincsenek közzétett hírek. Térj vissza később, hogy ne maradj le
          semmiről!
        </p>
      )}
    </WidgetShell>
  );
}

function ArticleRow({ article }: { article: Article }) {
  const categoryLabel =
    article.category && isArticleCategory(article.category)
      ? ARTICLE_CATEGORY_LABELS[article.category]
      : article.category;

  return (
    <li>
      <Link
        href={`/hirek/${article.id}`}
        className={cn(
          "group flex items-center gap-3 rounded-[var(--radius-md)] p-2 -mx-2",
          "transition-colors duration-200",
          "hover:bg-[var(--glass-bg-hover)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        {/* Thumbnail */}
        <div
          className={cn(
            "relative h-16 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm)]",
            "border border-[var(--glass-border)] bg-[var(--bg-secondary)]",
          )}
        >
          {article.image_url ? (
            <Image
              src={article.image_url}
              alt={article.title}
              fill
              sizes="80px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-sm tracking-wider text-[var(--text-muted)]">
              FCB
            </span>
          )}
        </div>

        {/* Copy */}
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "line-clamp-2 text-sm font-medium leading-snug",
              "text-[var(--text-primary)]",
              "transition-colors duration-200 group-hover:text-[var(--accent-gold)]",
            )}
          >
            {article.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            {categoryLabel && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 uppercase tracking-[0.14em]",
                  "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                )}
              >
                {categoryLabel}
              </span>
            )}
            <time dateTime={article.created_at}>
              {formatDate(article.created_at)}
            </time>
          </div>
        </div>
      </Link>
    </li>
  );
}
