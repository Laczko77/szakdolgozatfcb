/**
 * Pulsing placeholder used while the product list is loading.
 *
 * Mirrors the dimensions of `ProductCard` (4:5 image + body) so the layout
 * doesn't shift when real data arrives.  Uses Tailwind's `animate-pulse`
 * — no JS required.
 *
 * Rendered as a `<div>` (not `<li>`) so it can be safely composed inside
 * either a list-style grid or a generic `<div>` grid without producing
 * `<li>` inside `<li>` hydration errors.
 */
export function ProductCardSkeleton() {
  return (
    <div className="glass-card relative h-full overflow-hidden">
      <div className="aspect-[4/5] w-full animate-pulse bg-[var(--bg-secondary)]" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--glass-bg-strong)]" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--glass-bg)]" />
        <div className="mt-2 h-6 w-1/2 animate-pulse rounded bg-[var(--glass-bg-strong)]" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className={[
        "grid gap-5 sm:gap-6",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      ].join(" ")}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
