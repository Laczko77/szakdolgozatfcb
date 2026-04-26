"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import type { Article } from "@/types/database";
import {
  ARTICLE_CATEGORY_LABELS,
  isArticleCategory,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ArticleCardProps {
  article: Article;
  /** Used to drive a staggered reveal in the parent grid. */
  index?: number;
}

/**
 * Glass news card used on the /hirek listing.
 *
 * Layout matches the shop ProductCard so the entire portal reads as a
 * single design system: 4:5 image well on top, body below with title,
 * excerpt, and a date footer.  The whole card is the link target — no
 * orphan "Read more" affordance, the cursor is enough.
 */
export function ArticleCard({ article, index = 0 }: ArticleCardProps) {
  const categoryLabel =
    article.category && isArticleCategory(article.category)
      ? ARTICLE_CATEGORY_LABELS[article.category]
      : article.category;

  const excerpt = makeExcerpt(article.content, 140);

  return (
    <motion.li
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.05, 0.35),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className="group relative h-full"
    >
      <Link
        href={`/hirek/${article.id}`}
        className={cn(
          "glass-card glass-card-hover",
          "relative flex h-full flex-col overflow-hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        {/* Image well */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-secondary)]">
          {article.image_url ? (
            <Image
              src={article.image_url}
              alt={article.title}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className={cn(
                "object-cover transition-transform duration-700 ease-out",
                "group-hover:scale-[1.04]",
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
              <span className="font-display text-3xl tracking-wider opacity-40">
                FCB
              </span>
            </div>
          )}

          {/* Bottom gradient — keeps the category pill legible on bright photos. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent"
          />

          {categoryLabel && (
            <span
              className={cn(
                "absolute left-3 top-3 z-10",
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]",
                "border border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] backdrop-blur-md",
                "text-[var(--accent-gold)]",
              )}
            >
              {categoryLabel}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3
            className={cn(
              "font-display text-xl leading-tight tracking-wide",
              "text-[var(--text-primary)]",
              "transition-colors duration-300",
              "group-hover:text-[var(--accent-gold)]",
              // Two-line clamp keeps the grid even.
              "line-clamp-2",
            )}
          >
            {article.title}
          </h3>

          {excerpt && (
            <p className="text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-3">
              {excerpt}
            </p>
          )}

          <div className="mt-auto flex items-center gap-2 pt-2 text-xs text-[var(--text-muted)]">
            <Calendar size={12} aria-hidden />
            <time dateTime={article.created_at}>
              {formatDate(article.created_at)}
            </time>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

/**
 * Strip leading whitespace and clip to N chars on a word boundary.
 * Falls back to a hard cut if no boundary is found within the window.
 */
function makeExcerpt(content: string, maxChars: number): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  return `${slice.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : maxChars).trim()}…`;
}
