"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  fetchRecommendedProducts,
  type RecommendedProduct,
} from "@/lib/analytics-api";
import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { WidgetShell } from "./WidgetShell";
import { cn } from "@/lib/utils";

/**
 * "Ajánlott neked" dashboard widget — F14.3.
 *
 * Loads the same `recommended_products` ranking as the storefront's
 * popular section, but renders a denser 3-row list optimised for the
 * dashboard's tighter column. The widget is intentionally
 * self-hiding when the dataset is too thin (fewer than 3 hits) so
 * the dashboard doesn't show a sad-looking placeholder while the
 * portal is bootstrapping.
 *
 * Note: the parent dashboard decides whether to render this widget
 * at all (via `RecommendedProductsWidget`'s `onEmpty` callback), so
 * the grid layout doesn't end up with a phantom slot.
 */

const VISIBLE_COUNT = 3;

interface Props {
  index?: number;
  className?: string;
  /** Called once with the loaded count so the parent can choose to
   *  unmount the widget (and reclaim the grid slot) when the data
   *  is too thin to show. */
  onLoad?: (count: number) => void;
}

export function RecommendedProductsWidget({
  index = 0,
  className,
  onLoad,
}: Props) {
  const [items, setItems] = useState<RecommendedProduct[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchRecommendedProducts(VISIBLE_COUNT);
        if (!cancelled) {
          setItems(data);
          onLoad?.(data.length);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          onLoad?.(0);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide entirely when the dataset is too thin.
  if (!isLoading && (items === null || items.length < VISIBLE_COUNT)) {
    return null;
  }

  return (
    <WidgetShell
      eyebrow="Trending"
      title="Ajánlott neked"
      cta={{ label: "Webshop", href: "/shop" }}
      index={index}
      className={className}
    >
      {isLoading ? (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: VISIBLE_COUNT }).map((_, i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-xl",
                "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "p-3",
              )}
            >
              <div className="h-14 w-14 shrink-0 animate-pulse rounded-lg bg-[var(--bg-secondary)]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--bg-secondary)]" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--bg-secondary)]" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {items?.map((p, i) => (
            <motion.li
              key={p.product_id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.05 * i,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <Link
                href={`/shop/${p.product_id}`}
                className={cn(
                  "group flex items-center gap-3 rounded-xl",
                  "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                  "p-3",
                  "transition-all duration-200",
                  "hover:border-[var(--accent-gold)]/40 hover:bg-[var(--glass-bg-strong)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                )}
              >
                <div
                  className={cn(
                    "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg",
                    "bg-[var(--bg-secondary)]",
                  )}
                >
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      sizes="56px"
                      className={cn(
                        "object-cover",
                        "transition-transform duration-500 ease-out",
                        "group-hover:scale-110",
                      )}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] tracking-wider text-[var(--text-muted)]">
                      FCB
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      "text-[var(--text-primary)]",
                      "group-hover:text-[var(--accent-gold)]",
                      "transition-colors",
                    )}
                  >
                    {p.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    {p.avg_rating > 0 && (
                      <span aria-label={`${p.avg_rating.toFixed(1)} csillag`}>
                        {"★".repeat(Math.round(p.avg_rating))}
                        <span className="text-[var(--text-muted)]">
                          {"★".repeat(5 - Math.round(p.avg_rating))}
                        </span>
                      </span>
                    )}
                    <span className="font-display tracking-wider text-[var(--accent-gold)]">
                      {formatPrice(p.price)}
                    </span>
                  </p>
                </div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}
