import { cn } from "@/lib/utils";

/**
 * Skeleton placeholders for the news listing.
 *
 * Mirrors the dimensions of ArticleCard / HeroArticle so the layout
 * doesn't reflow when real content arrives. Uses Tailwind's built-in
 * `animate-pulse` — no JS needed.
 */

export function ArticleCardSkeleton() {
  return (
    <li className="glass-card relative flex h-full flex-col overflow-hidden">
      <div className="aspect-[16/10] w-full animate-pulse bg-[var(--glass-bg-hover)]" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-full animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="mt-auto h-2.5 w-1/3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
      </div>
    </li>
  );
}

export function ArticleGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul
      className={cn(
        "grid gap-5 sm:gap-6",
        "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
      )}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </ul>
  );
}

export function HeroArticleSkeleton() {
  return (
    <div className="glass-card relative grid grid-cols-1 overflow-hidden lg:grid-cols-[1.4fr_1fr]">
      <div className="aspect-[16/10] w-full animate-pulse bg-[var(--glass-bg-hover)] lg:aspect-auto lg:min-h-[420px]" />
      <div className="flex flex-col gap-5 p-6 sm:p-10">
        <div className="h-3 w-1/4 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        <div className="h-12 w-11/12 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="h-12 w-9/12 animate-pulse rounded-md bg-[var(--glass-bg-hover)]" />
        <div className="space-y-2 pt-2">
          <div className="h-3 w-full animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <div className="h-3 w-5/6 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        </div>
      </div>
    </div>
  );
}
