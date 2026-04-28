"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Calendar } from "lucide-react";
import type { Article } from "@/types/database";
import {
  ARTICLE_CATEGORY_LABELS,
  isArticleCategory,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { htmlExcerpt } from "@/lib/html-excerpt";
import { cn } from "@/lib/utils";

interface HeroArticleProps {
  article: Article;
}

/**
 * Editorial "lead story" card for the news landing.
 *
 * Asymmetric 60/40 split on desktop (image left, copy right) — modelled
 * on classic broadsheet front pages.  Mobile collapses to a stacked
 * card with an oversized image and headline below.  The headline is
 * the dominant element by far: Bebas Neue at 5xl/6xl, the rest of the
 * page lays out around it.
 */
export function HeroArticle({ article }: HeroArticleProps) {
  const categoryLabel =
    article.category && isArticleCategory(article.category)
      ? ARTICLE_CATEGORY_LABELS[article.category]
      : article.category;

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative"
    >
      <Link
        href={`/hirek/${article.id}`}
        className={cn(
          "group block overflow-hidden",
          "glass-card glass-card-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
          {/* Image side */}
          <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[420px] overflow-hidden bg-[var(--bg-secondary)]">
            {article.image_url ? (
              <Image
                src={article.image_url}
                alt={article.title}
                fill
                priority
                sizes="(min-width: 1024px) 60vw, 100vw"
                className={cn(
                  "object-cover transition-transform duration-[900ms] ease-out",
                  "group-hover:scale-[1.04]",
                )}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="font-display text-7xl tracking-widest text-[var(--accent-gold)] opacity-40">
                  FCB
                </span>
              </div>
            )}

            {/* Editorial gradient — heavy at the bottom on desktop where the
                category pill lives, full overlay on small screens for legibility. */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0",
                "bg-gradient-to-t from-black/70 via-black/20 to-transparent",
                "lg:bg-gradient-to-r lg:from-black/40 lg:via-transparent lg:to-transparent",
              )}
            />

            {/* "Kiemelt" ribbon on the image — establishes hierarchy at a glance. */}
            <div
              className={cn(
                "absolute left-4 top-4 z-10 flex items-center gap-2",
                "rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]",
                "border border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] backdrop-blur-md",
                "text-[var(--accent-gold)]",
              )}
            >
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-[var(--accent-gold)]"
              />
              Kiemelt
            </div>

            {/* Category pill — bottom-left, only on the image side at sm+ where
                we have darkness to land it on. */}
            {categoryLabel && (
              <span
                className={cn(
                  "absolute bottom-4 left-4 z-10",
                  "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em]",
                  "border border-[var(--glass-border-hover)] bg-black/40 backdrop-blur-md",
                  "text-white",
                )}
              >
                {categoryLabel}
              </span>
            )}
          </div>

          {/* Copy side */}
          <div className="flex flex-col justify-between gap-6 p-6 sm:p-10">
            <div className="space-y-5">
              <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
                {formatDate(article.created_at)}
              </p>

              <h2
                className={cn(
                  "font-display tracking-wide leading-[0.95]",
                  "text-[var(--text-primary)]",
                  "text-4xl sm:text-5xl lg:text-6xl",
                  "transition-colors duration-300 group-hover:text-[var(--accent-gold)]",
                )}
              >
                {article.title}
              </h2>

              <p className="text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg line-clamp-4">
                {htmlExcerpt(article.content, 220)}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <Calendar size={12} aria-hidden />
                <time dateTime={article.created_at}>
                  {formatDate(article.created_at)}
                </time>
              </div>

              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2",
                  "text-xs font-medium uppercase tracking-[0.2em]",
                  "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                  "text-[var(--text-primary)]",
                  "transition-all duration-300",
                  "group-hover:border-[var(--accent-gold)] group-hover:text-[var(--accent-gold)]",
                )}
              >
                Olvasom
                <ArrowUpRight
                  size={14}
                  className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.section>
  );
}

