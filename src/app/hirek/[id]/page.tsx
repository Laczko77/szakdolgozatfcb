import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ARTICLE_CATEGORY_LABELS,
  isArticleCategory,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Article } from "@/types/database";
import { ArticleContent } from "@/components/news/ArticleContent";
import { RelatedArticles } from "@/components/news/RelatedArticles";
import { htmlExcerpt } from "@/lib/html-excerpt";
import { cn } from "@/lib/utils";

/**
 * /hirek/[id] — public article detail page.
 *
 * Rendered as a Server Component because:
 *  - Better SEO (full HTML on first paint, OpenGraph metadata).
 *  - We can hit Supabase directly without bouncing through /api.
 *  - The page is mostly static text — there's nothing that needs
 *    client interactivity here.
 *
 * The "Vissza a hírekhez" link is the only navigation surface; the
 * rest of the page is a single, focused reading column.
 */

type RouteParams = { id: string };

interface PageProps {
  params: Promise<RouteParams>;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getArticle(id: string): Promise<Article | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Article;
}

/**
 * Pulls 3 recent articles to render in the "Related" rail.
 *
 * We prefer same-category neighbours when one exists; otherwise we fall
 * back to the latest 3 from any category.  The current article is
 * always excluded from the result.
 */
async function getRelatedArticles(
  currentId: string,
  category: string | null,
): Promise<Article[]> {
  const supabase = await createClient();

  if (category) {
    const { data } = await supabase
      .from("articles")
      .select("*")
      .eq("category", category)
      .neq("id", currentId)
      .order("created_at", { ascending: false })
      .limit(3);
    if (data && data.length > 0) return data as Article[];
  }

  const { data } = await supabase
    .from("articles")
    .select("*")
    .neq("id", currentId)
    .order("created_at", { ascending: false })
    .limit(3);

  return (data ?? []) as Article[];
}

// ---------------------------------------------------------------------------
// Metadata — drives <title>, OpenGraph, Twitter cards.
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) {
    return { title: "A hír nem található" };
  }

  // F18.4 — content is now Tiptap HTML; strip tags before pulling the
  // OpenGraph description, otherwise the meta tag would contain raw markup.
  const description = htmlExcerpt(article.content, 160) || undefined;

  return {
    title: article.title,
    description,
    openGraph: {
      title: article.title,
      description,
      images: article.image_url ? [{ url: article.image_url }] : undefined,
      type: "article",
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ArticleDetailPage({ params }: PageProps) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();

  const related = await getRelatedArticles(article.id, article.category);

  const categoryLabel =
    article.category && isArticleCategory(article.category)
      ? ARTICLE_CATEGORY_LABELS[article.category]
      : article.category;

  return (
    <article className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Back navigation — minimal, monochrome, doesn't compete with the
          title. Pattern matches /jatekosok/[id] for a consistent
          detail-page chrome across the portal. */}
      <Link
        href="/hirek"
        className={cn(
          "group inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em]",
          "text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        )}
      >
        <ArrowLeft
          size={14}
          className="transition-transform duration-300 group-hover:-translate-x-0.5"
        />
        Vissza a hírekhez
      </Link>

      {/* Hero image — wide, dramatic, single visual focal point.
          Anchors the article and gives the masthead room to breathe below. */}
      {article.image_url && (
        <div
          className={cn(
            "relative mt-6 overflow-hidden",
            "aspect-[16/9] sm:aspect-[21/9]",
            "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
            "bg-[var(--bg-secondary)]",
          )}
        >
          <Image
            src={article.image_url}
            alt={article.title}
            fill
            priority
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="object-cover"
          />
          {/* Subtle bottom vignette so any caption-like element below the
              image visually attaches to it without a hard seam. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"
          />
        </div>
      )}

      {/* Masthead — kategória + title + meta.  Constrained to the same
          720px column as the body so they read as one unit. */}
      <header className="mx-auto mt-10 max-w-[760px] sm:mt-14">
        {categoryLabel && (
          <span
            className={cn(
              "inline-block rounded-full px-3 py-1.5",
              "text-[10px] font-semibold uppercase tracking-[0.22em]",
              "border border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] backdrop-blur-md",
              "text-[var(--accent-gold)]",
            )}
          >
            {categoryLabel}
          </span>
        )}

        <h1
          className={cn(
            "mt-5 font-display tracking-wide leading-[0.95]",
            "text-[var(--text-primary)]",
            "text-4xl sm:text-5xl lg:text-6xl",
          )}
        >
          {article.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
          <span className="flex items-center gap-2">
            <Calendar size={12} aria-hidden />
            <time dateTime={article.created_at}>
              {formatDate(article.created_at)}
            </time>
          </span>
          {article.updated_at &&
            article.updated_at !== article.created_at && (
              <span className="text-[var(--text-muted)]">
                Frissítve: {formatDate(article.updated_at)}
              </span>
            )}
        </div>

        {/* Hairline rule — closes the masthead and opens the reading column. */}
        <div className="mt-8 h-px w-24 bg-[var(--accent-gold)]/60" />
      </header>

      {/* Body — narrow reading column, drop-cap on first paragraph. */}
      <div className="mx-auto mt-10 max-w-[720px] pb-4">
        <ArticleContent content={article.content} />
      </div>

      {/* Footer rule + back-to-listing */}
      <div className="mx-auto max-w-[720px] border-t border-[var(--glass-border)] pt-8">
        <Link
          href="/hirek"
          className={cn(
            "group inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em]",
            "text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)]",
          )}
        >
          <ArrowLeft
            size={14}
            className="transition-transform duration-300 group-hover:-translate-x-0.5"
          />
          Vissza a hírekhez
        </Link>
      </div>

      <RelatedArticles articles={related} />
    </article>
  );
}
