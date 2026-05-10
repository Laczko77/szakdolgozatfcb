"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import type { Review } from "@/types/database";
import {
  fetchProduct,
  type ProductDetailResponse,
} from "@/lib/shop-api";
import { ProductGallery } from "@/components/shop/ProductGallery";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";
import { VariantPicker } from "@/components/shop/VariantPicker";
import { QuantityStepper } from "@/components/shop/QuantityStepper";
import { RatingStars } from "@/components/shop/RatingStars";
import { WishlistHeart } from "@/components/shop/WishlistHeart";
import { ReviewList } from "@/components/shop/ReviewList";
import { ReviewModal } from "@/components/shop/ReviewModal";
import { SaleBadge, computePercentOff } from "@/components/shop/SaleBadge";
import { SalePriceBlock } from "@/components/shop/SalePriceBlock";
import { SaleCountdown } from "@/components/shop/SaleCountdown";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductDetailPage({ params }: PageProps) {
  const { id } = use(params);

  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const { addItem, openCart } = useCart();

  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [authors, setAuthors] = useState<
    Record<string, { username: string | null; avatarUrl: string | null }>
  >({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const fresh = await fetchProduct(id);
      setData(fresh);
      setNotFound(false);

      // Hydrate review authors via the public profiles table.  The reviews
      // API does not join profiles, so we look them up here in a single
      // batched query keyed by user_id.  Failure is non-fatal — the list
      // still renders with the "Szurkoló" fallback if the lookup errors.
      if (fresh && fresh.reviews.length > 0) {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          const supabase = createClient();
          const userIds = [
            ...new Set(fresh.reviews.map((r) => r.user_id)),
          ];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .in("id", userIds);
          if (profiles) {
            const map: Record<
              string,
              { username: string | null; avatarUrl: string | null }
            > = {};
            for (const p of profiles as Array<{
              id: string;
              username: string | null;
              avatar_url: string | null;
            }>) {
              map[p.id] = {
                username: p.username ?? null,
                avatarUrl: p.avatar_url ?? null,
              };
            }
            setAuthors(map);
          }
        } catch {
          // Swallow — the list renders fine without authors.
        }
      } else {
        setAuthors({});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Termék nem található";
      if (/404|nem található/i.test(msg)) setNotFound(true);
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The selected variant is the one matching both axes — collapses to the
  // sole variant for products with only one axis.
  const selectedVariant = useMemo(() => {
    if (!data) return null;
    return (
      data.variants.find(
        (v) =>
          (selectedSize ? v.size === selectedSize : true) &&
          (selectedColor ? v.color === selectedColor : true),
      ) ?? null
    );
  }, [data, selectedSize, selectedColor]);

  // Has the user already left a review?  We compare server-side review
  // user_ids against the current user — once true the "Write a review"
  // CTA disables and the existing review is highlighted in the list.
  const userReview = useMemo<Review | null>(() => {
    if (!data || !user) return null;
    return data.reviews.find((r) => r.user_id === user.id) ?? null;
  }, [data, user]);

  // Stock for the currently chosen variant — drives the +/- max and the
  // "Add to cart" button enablement.
  const availableStock = selectedVariant?.stock ?? 0;
  const hasVariants = (data?.variants.length ?? 0) > 0;
  const canAdd =
    hasVariants &&
    selectedVariant !== null &&
    availableStock >= quantity &&
    quantity > 0;

  // Clamp quantity if user lowers stock by switching variant.  We use a
  // microtask deferral so the setState is not called synchronously inside
  // the effect — keeps the React 19 lint rule satisfied.
  useEffect(() => {
    if (availableStock > 0 && quantity > availableStock) {
      queueMicrotask(() => setQuantity(availableStock));
    }
  }, [availableStock, quantity]);

  const handleAddToCart = async () => {
    if (!user) {
      toast.info("Jelentkezz be a vásárláshoz");
      router.push(
        `/login?returnUrl=${encodeURIComponent(`/shop/${id}`)}`,
      );
      return;
    }
    if (!selectedVariant) {
      toast.error("Válassz méretet és színt");
      return;
    }
    setAdding(true);
    try {
      await addItem(selectedVariant.id, quantity);
      toast.success("A termék a kosárba került");
      openCart();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kosárba helyezés sikertelen",
      );
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <ProductDetailSkeleton />;

  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-display text-3xl tracking-wider text-[var(--text-primary)]">
          A termék nem található
        </p>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Lehet, hogy elköltözött, vagy már nem elérhető.
        </p>
        <Link href="/shop" className="glass-button-secondary mt-6 inline-flex">
          Vissza a shopba
        </Link>
      </div>
    );
  }

  const { product, variants, reviews, averageRating, reviewCount } = data;

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 sm:py-8 lg:px-10">
      {/* Back link */}
      <Link
        href="/shop"
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]",
          "hover:text-[var(--text-primary)] transition-colors mb-6",
        )}
      >
        <ArrowLeft size={14} />
        Vissza a shopba
      </Link>

      {/* Two-column layout */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Image side — F32 ProductGallery: thumbnails + lightbox + swipe.
            Falls back gracefully to a single-image layout when the product
            is a legacy entry (empty `images` array, only `image_url`). */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative"
        >
          <ProductGallery
            images={product.images}
            fallbackUrl={product.image_url}
            alt={product.name}
          />
        </motion.div>

        {/* Info side */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="flex flex-col"
        >
          {/* Header row: category pill + sale badge sit side-by-side so the
              shopper sees both signals at once. The sale badge wins focus
              when present (red), but we keep the category visible because
              navigation back to peers ("more jerseys") needs the label. */}
          <div className="flex flex-wrap items-center gap-3">
            {product.category && (
              <span className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
                {product.category}
              </span>
            )}
            {product.is_on_sale && (
              <SaleBadge
                size="lg"
                percentOff={computePercentOff(
                  Number(product.price),
                  product.sale_price,
                )}
              />
            )}
          </div>
          <h1 className="mt-2 font-display text-4xl leading-tight tracking-wider text-[var(--text-primary)] sm:text-5xl">
            {product.name}
          </h1>

          <div className="mt-4 flex items-center gap-4">
            <RatingStars value={averageRating} count={reviewCount} size={16} />
            <span className="text-xs text-[var(--text-muted)]">
              {averageRating > 0 ? `${averageRating.toFixed(1)} / 5` : "—"}
            </span>
          </div>

          {/* Price block — when on sale, shows the effective price in red
              alongside the original strikethrough, plus an explicit
              "Megspórolsz" line so the saving reads as a number, not just
              a comparison. */}
          <div className="mt-6">
            <SalePriceBlock
              price={Number(product.price)}
              effectivePrice={Number(product.effective_price)}
              isOnSale={product.is_on_sale}
              size="xl"
              layout="inline"
            />
            {product.is_on_sale &&
              (() => {
                const original = Number(product.price);
                const effective = Number(product.effective_price);
                const saved = Math.max(0, original - effective);
                const pct = computePercentOff(original, product.sale_price);
                if (saved <= 0) return null;
                return (
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-red)]">
                    <span aria-hidden>💸</span>
                    Megspórolsz:{" "}
                    <span className="font-display font-semibold tracking-wide">
                      −{saved.toLocaleString("hu-HU")} Ft
                    </span>
                    {pct !== null && (
                      <span className="text-[var(--text-secondary)]">
                        (−{pct}%)
                      </span>
                    )}
                  </p>
                );
              })()}
          </div>

          {/* Live countdown — only rendered when there's a sale with a
              concrete end timestamp. On expiry it triggers `refresh()` so
              the API serves the post-sale price and this block unmounts. */}
          {product.is_on_sale && product.sale_ends_at && (
            <div className="mt-5">
              <SaleCountdown
                endsAt={product.sale_ends_at}
                onExpire={() => {
                  void refresh();
                }}
              />
            </div>
          )}

          {product.description && (
            <p className="mt-5 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              {product.description}
            </p>
          )}

          {/* Divider */}
          <hr className="my-7 border-[var(--glass-border)]" />

          {/* Variants */}
          {variants.length > 0 ? (
            <VariantPicker
              variants={variants}
              selectedSize={selectedSize}
              selectedColor={selectedColor}
              onChange={(next) => {
                setSelectedSize(next.size);
                setSelectedColor(next.color);
              }}
            />
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              Ehhez a termékhez még nincsenek elérhető variánsok.
            </p>
          )}

          {/* Stock indicator */}
          {selectedVariant && (
            <p
              className={cn(
                "mt-4 text-xs uppercase tracking-[0.2em]",
                availableStock > 5
                  ? "text-[var(--text-secondary)]"
                  : availableStock > 0
                    ? "text-[var(--accent-gold)]"
                    : "text-[var(--accent-red)]",
              )}
            >
              {availableStock === 0
                ? "Elfogyott"
                : availableStock <= 5
                  ? `Csak ${availableStock} db raktáron`
                  : `${availableStock} db raktáron`}
            </p>
          )}

          {/* Quantity + add to cart */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={Math.max(1, availableStock)}
              disabled={!selectedVariant || availableStock === 0}
            />

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAdd || adding}
              className={cn(
                "glass-button-primary flex-1 min-w-[200px] justify-center",
                canAdd && !adding && "cta-pulse",
                !canAdd && "opacity-60 cursor-not-allowed",
              )}
            >
              <ShoppingBag size={16} strokeWidth={2} />
              {adding ? "Hozzáadás…" : "Kosárba"}
            </button>

            <WishlistHeart productId={product.id} framed={false} size={20} />
          </div>
        </motion.div>
      </div>

      {/* Reviews section */}
      <section className="mt-16 sm:mt-20">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
              Vélemények
            </p>
            <h2 className="mt-1 font-display text-3xl tracking-wider text-[var(--text-primary)] sm:text-4xl">
              {reviewCount > 0
                ? `${reviewCount} értékelés`
                : "Még nincs értékelés"}
            </h2>
          </div>

          {user && (
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              disabled={Boolean(userReview)}
              className={cn(
                "glass-button-secondary",
                userReview && "opacity-60 cursor-not-allowed",
              )}
            >
              {userReview ? "Már értékelted ✓" : "Értékelés írása"}
            </button>
          )}
        </header>

        <ReviewList reviews={reviews} authors={authors} />
      </section>

      {/* Modal */}
      <ReviewModal
        productId={product.id}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onSubmitted={refresh}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton — keeps layout stable while we fetch
// ---------------------------------------------------------------------------

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 h-4 w-24 animate-pulse rounded bg-[var(--glass-bg-strong)]" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="aspect-[4/5] animate-pulse rounded-[var(--radius-lg)] bg-[var(--glass-bg-strong)]" />
        <div className="flex flex-col gap-4">
          <div className="h-3 w-20 animate-pulse rounded bg-[var(--glass-bg-strong)]" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-[var(--glass-bg-strong)]" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-[var(--glass-bg)]" />
          <div className="h-9 w-1/4 animate-pulse rounded bg-[var(--glass-bg-strong)]" />
          <div className="mt-4 h-24 animate-pulse rounded bg-[var(--glass-bg)]" />
          <div className="mt-6 flex gap-3">
            <div className="h-11 w-32 animate-pulse rounded-full bg-[var(--glass-bg-strong)]" />
            <div className="h-11 flex-1 animate-pulse rounded-full bg-[var(--glass-bg-strong)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
