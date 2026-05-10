"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Sparkles,
  Tag,
  X as XIcon,
} from "lucide-react";
import type { ShippingAddress } from "@/types/database";
import { createOrder } from "@/lib/shop-api";
import {
  fetchMyCoupons,
  formatDiscount,
  previewDiscount,
  type RedeemedCouponWithDef,
} from "@/lib/coupons-api";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SalePriceBlock } from "@/components/shop/SalePriceBlock";

type Step = 1 | 2;

interface FormState extends ShippingAddress {
  phone: string;
  coupon: string;
}

const initialForm: FormState = {
  full_name: "",
  country: "Magyarország",
  city: "",
  postal_code: "",
  street: "",
  phone: "",
  coupon: "",
};

/**
 * Two-step checkout flow.
 *
 * Step 1 — Shipping form + optional coupon code.  Coupons are now
 *          actually wired up (F13.4): we client-side-preview the discount
 *          using the caller's redeemed_coupons list so the summary shows
 *          a realistic total before submission.  Final validation happens
 *          server-side inside `applyCouponToOrder`.
 *
 * Step 2 — Order summary with line items, totals, "Megrendelés (demo)"
 *          button.  On success we navigate to the success page; on
 *          failure we surface the error and stay on step 2 so the user
 *          can retry.
 */
export default function CheckoutPage() {
  return (
    <ProtectedRoute>
      <CheckoutContent />
    </ProtectedRoute>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { profile, user } = useAuth();
  const toast = useToast();
  const { cartItems, cartTotal, cartCount, clearLocalCart } = useCart();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  // Caller's redeemed coupons — used for client-side preview of the
  // discount on the entered code.  We deliberately fetch on mount so the
  // user can paste a code and immediately see it apply.
  const [myCoupons, setMyCoupons] = useState<RedeemedCouponWithDef[]>([]);

  // Pre-fill the full name from the profile if we have one — small UX win.
  useEffect(() => {
    if (profile?.username && !form.full_name) {
      queueMicrotask(() =>
        setForm((prev) => ({ ...prev, full_name: profile.username ?? "" })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.username]);

  // Fetch the user's active (is_used = false) redeemed coupons so we can
  // preview the discount the moment they type/paste a code.
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const list = await fetchMyCoupons({
          isUsed: false,
          signal: controller.signal,
        });
        setMyCoupons(list);
      } catch {
        // Silent failure — preview is a nice-to-have.  Server still
        // validates on submit.
      }
    })();
    return () => controller.abort();
  }, [user?.id]);

  // If the cart empties (e.g. last item removed in a different tab),
  // bounce back to /shop with a friendly note.
  useEffect(() => {
    if (cartCount === 0 && !submitting) {
      router.replace("/shop");
    }
  }, [cartCount, submitting, router]);

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.full_name.trim()) next.full_name = "Add meg a nevedet";
    if (!form.country.trim()) next.country = "Add meg az országot";
    if (!form.city.trim()) next.city = "Add meg a várost";
    if (!form.postal_code.trim()) next.postal_code = "Add meg az irányítószámot";
    if (!form.street.trim()) next.street = "Add meg az utcát és házszámot";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStep(2);
    if (typeof window !== "undefined")
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  // -------------------------------------------------------------------------
  // Coupon preview
  //
  // The redeemed_coupons row owned by this user already carries the
  // discount_type/discount_value via the joined coupon definition. We
  // match the entered code (case-insensitive, trimmed) against this list
  // and preview the discount on the cart subtotal.
  //
  // States:
  //   - empty       → no preview
  //   - matched     → "Kedvezmény alkalmazva" + line in summary
  //   - not_matched → "Ismeretlen kuponkód" warning (after debounce)
  // -------------------------------------------------------------------------

  // F29 — sum of catalogue prices the customer would have paid without
  // active sales. `cartTotal` already uses the snapshot price (sale-aware),
  // so subtotal − cartTotal === total amount saved by sales (excludes the
  // coupon, which is summarised separately below).
  const catalogueSubtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) =>
          sum + Number(item.variant?.product?.price ?? 0) * item.quantity,
        0,
      ),
    [cartItems],
  );
  const saleSavings = Math.max(0, catalogueSubtotal - cartTotal);

  const couponPreview = useMemo(() => {
    const code = form.coupon.trim().toUpperCase();
    if (!code) {
      return {
        kind: "empty" as const,
        discount: 0,
        finalTotal: cartTotal,
      };
    }
    const match = myCoupons.find(
      (c) => c.code.toUpperCase() === code && c.coupon !== null,
    );
    if (!match || !match.coupon) {
      return {
        kind: "unknown" as const,
        discount: 0,
        finalTotal: cartTotal,
      };
    }
    const computed = previewDiscount(
      cartTotal,
      match.coupon.discount_type,
      match.coupon.discount_value,
    );
    return {
      kind: "matched" as const,
      coupon: match.coupon,
      discount: computed.discount,
      finalTotal: computed.final,
    };
  }, [form.coupon, myCoupons, cartTotal]);

  const onPickCoupon = (code: string) => {
    setForm((p) => ({ ...p, coupon: code }));
  };

  const onClearCoupon = () => {
    setForm((p) => ({ ...p, coupon: "" }));
  };

  const onPlaceOrder = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const shipping: ShippingAddress = {
        full_name: form.full_name.trim(),
        country: form.country.trim(),
        city: form.city.trim(),
        postal_code: form.postal_code.trim(),
        street: form.street.trim(),
      };
      if (form.phone.trim()) shipping.phone = form.phone.trim();

      const couponCode = form.coupon.trim();
      const result = await createOrder({
        shipping_address: shipping,
        coupon_code: couponCode || null,
      });
      if (result.warning) {
        toast.info(result.warning);
      }
      if (result.coupon) {
        toast.success(
          `Kupon alkalmazva: −${result.coupon.discount.toLocaleString("hu-HU")} Ft`,
        );
      }
      clearLocalCart();
      router.replace(`/shop/checkout/success?orderId=${result.order.id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Rendelés leadása sikertelen",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
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

      <header className="mb-8">
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Pénztár
        </p>
        <h1 className="mt-2 font-display text-4xl leading-none tracking-wider text-[var(--text-primary)] sm:text-5xl">
          Rendelés véglegesítése
        </h1>
      </header>

      {/* Step indicator */}
      <ol className="mb-8 flex items-center gap-3 text-sm">
        <StepBadge index={1} active={step === 1} done={step > 1} label="Szállítás" />
        <ChevronRight size={14} className="text-[var(--text-muted)]" />
        <StepBadge index={2} active={step === 2} done={false} label="Összegzés" />
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left: step content */}
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.section
              key="step1"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="glass-card p-5 sm:p-7"
            >
              <h2 className="font-display text-2xl tracking-wider text-[var(--text-primary)]">
                Szállítási adatok
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Demo rendelés — nem kerül sor valós szállításra. Add meg a
                kötelező mezőket, hogy lássuk, hogyan menne ki a csomag.
              </p>

              <form onSubmit={onContinue} className="mt-6 grid gap-4">
                <Field
                  id="full_name"
                  label="Teljes név"
                  value={form.full_name}
                  onChange={(v) => setForm((p) => ({ ...p, full_name: v }))}
                  error={errors.full_name}
                  autoComplete="name"
                />
                <Field
                  id="country"
                  label="Ország"
                  value={form.country}
                  onChange={(v) => setForm((p) => ({ ...p, country: v }))}
                  error={errors.country}
                  autoComplete="country-name"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="postal_code"
                    label="Irányítószám"
                    value={form.postal_code}
                    onChange={(v) => setForm((p) => ({ ...p, postal_code: v }))}
                    error={errors.postal_code}
                    autoComplete="postal-code"
                  />
                  <Field
                    id="city"
                    label="Város"
                    value={form.city}
                    onChange={(v) => setForm((p) => ({ ...p, city: v }))}
                    error={errors.city}
                    autoComplete="address-level2"
                  />
                </div>
                <Field
                  id="street"
                  label="Utca, házszám"
                  value={form.street}
                  onChange={(v) => setForm((p) => ({ ...p, street: v }))}
                  error={errors.street}
                  autoComplete="street-address"
                />
                <Field
                  id="phone"
                  label="Telefonszám (nem kötelező)"
                  value={form.phone}
                  onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  type="tel"
                  autoComplete="tel"
                />

                <hr className="my-2 border-[var(--glass-border)]" />

                {/* Coupon block */}
                <CouponField
                  value={form.coupon}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, coupon: v.toUpperCase() }))
                  }
                  onClear={onClearCoupon}
                  preview={couponPreview}
                  myCoupons={myCoupons}
                  onPick={onPickCoupon}
                />

                <button
                  type="submit"
                  className="glass-button-primary mt-4 self-end"
                >
                  Tovább az összegzéshez
                </button>
              </form>
            </motion.section>
          ) : (
            <motion.section
              key="step2"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="glass-card p-5 sm:p-7"
            >
              <h2 className="font-display text-2xl tracking-wider text-[var(--text-primary)]">
                Rendelés összegzése
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Ellenőrizd a tételeket és a szállítási címet, mielőtt leadod a
                demo rendelést.
              </p>

              {/* Items */}
              <ul className="mt-5 flex flex-col divide-y divide-[var(--glass-border)]">
                {cartItems.map((item) => {
                  const product = item.variant?.product;
                  const catalogPrice = Number(product?.price ?? 0);
                  const snapshot = Number(item.unit_price_snapshot ?? 0);
                  const effectiveUnit =
                    snapshot > 0 ? snapshot : catalogPrice;
                  const isDiscounted =
                    snapshot > 0 && snapshot < catalogPrice;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-4 py-3"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--bg-secondary)]">
                        {product?.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product?.name ?? ""}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm tracking-wide text-[var(--text-primary)] truncate">
                          {product?.name}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {[item.variant?.size, item.variant?.color]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          · {item.quantity} db
                        </p>
                      </div>
                      <SalePriceBlock
                        price={catalogPrice * item.quantity}
                        effectivePrice={effectiveUnit * item.quantity}
                        isOnSale={isDiscounted}
                        size="sm"
                        layout="stacked"
                        className="items-end text-right"
                      />
                    </li>
                  );
                })}
              </ul>

              {/* Shipping */}
              <div
                className={cn(
                  "mt-6 rounded-md border border-[var(--glass-border)] p-4",
                  "bg-[var(--glass-bg)]",
                )}
              >
                <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Szállítási cím
                </p>
                <p className="mt-2 text-sm text-[var(--text-primary)]">
                  {form.full_name}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {form.postal_code} {form.city}, {form.street}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {form.country}
                  {form.phone && ` · ${form.phone}`}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="glass-button-secondary"
                >
                  Adatok módosítása
                </button>
                <button
                  type="button"
                  onClick={onPlaceOrder}
                  disabled={submitting || cartItems.length === 0}
                  className={cn(
                    "glass-button-primary cta-pulse",
                    submitting && "opacity-70 cursor-not-allowed",
                  )}
                >
                  <Sparkles size={14} strokeWidth={2} />
                  {submitting ? "Leadás…" : "Megrendelés (demo)"}
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Right: order summary card */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass-card-strong p-5">
            <h3 className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
              Összesítő
            </h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <dt>Tételek ({cartCount})</dt>
                <dd className="flex items-baseline gap-2 text-[var(--text-primary)]">
                  {saleSavings > 0 && (
                    <s className="text-xs text-[var(--text-muted)] decoration-[var(--text-muted)]/70 decoration-[1.5px]">
                      {formatPrice(catalogueSubtotal)}
                    </s>
                  )}
                  <span>{formatPrice(cartTotal)}</span>
                </dd>
              </div>

              {/* F29 — sale savings line. Only shown when at least one
                  cart item carries a snapshot below its catalogue price. */}
              <AnimatePresence>
                {saleSavings > 0 && (
                  <motion.div
                    key="sale-savings-line"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="flex justify-between"
                  >
                    <dt className="flex items-center gap-1.5 text-[var(--accent-red)]">
                      <Sparkles size={12} aria-hidden />
                      Megspórolt összeg
                    </dt>
                    <dd className="font-display tabular-nums text-[var(--accent-red)]">
                      −{formatPrice(saleSavings)}
                    </dd>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between text-[var(--text-secondary)]">
                <dt>Szállítás</dt>
                <dd className="text-[var(--text-primary)]">Ingyenes</dd>
              </div>

              {/* Discount line — only when a valid coupon is matched */}
              <AnimatePresence>
                {couponPreview.kind === "matched" && (
                  <motion.div
                    key="discount-line"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="flex justify-between"
                  >
                    <dt className="flex items-center gap-1.5 text-[var(--accent-gold)]">
                      <Tag size={12} aria-hidden />
                      Kupon ({form.coupon})
                    </dt>
                    <dd className="font-display tabular-nums text-[var(--accent-gold)]">
                      −{formatPrice(couponPreview.discount)}
                    </dd>
                  </motion.div>
                )}
              </AnimatePresence>

              <hr className="my-3 border-[var(--glass-border)]" />
              <div className="flex items-baseline justify-between">
                <dt className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Végösszeg
                </dt>
                <dd className="font-display text-2xl tracking-wide text-[var(--accent-gold)]">
                  {formatPrice(couponPreview.finalTotal)}
                </dd>
              </div>
              {couponPreview.kind === "matched" && (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {formatDiscount(
                    couponPreview.coupon.discount_type,
                    couponPreview.coupon.discount_value,
                  )}{" "}
                  kedvezmény alkalmazva.
                </p>
              )}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coupon field with validation feedback + "use one of mine" picker.
// ---------------------------------------------------------------------------

interface CouponFieldProps {
  value: string;
  onChange: (next: string) => void;
  onClear: () => void;
  preview:
    | { kind: "empty"; discount: number; finalTotal: number }
    | { kind: "unknown"; discount: number; finalTotal: number }
    | {
        kind: "matched";
        coupon: NonNullable<RedeemedCouponWithDef["coupon"]>;
        discount: number;
        finalTotal: number;
      };
  myCoupons: RedeemedCouponWithDef[];
  onPick: (code: string) => void;
}

function CouponField({
  value,
  onChange,
  onClear,
  preview,
  myCoupons,
  onPick,
}: CouponFieldProps) {
  const usable = myCoupons.filter((c) => !c.is_used && c.coupon !== null);
  const showPicker = usable.length > 0 && value.trim().length === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="coupon"
        className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]"
      >
        Kuponkód (nem kötelező)
      </label>
      <div className="relative">
        <Tag
          size={14}
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2",
            preview.kind === "matched"
              ? "text-[var(--accent-gold)]"
              : "text-[var(--text-muted)]",
          )}
          aria-hidden
        />
        <input
          id="coupon"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="BARCA-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          className={cn(
            "w-full rounded-md pl-9 pr-9 py-2.5 text-sm tracking-[0.18em] tabular-nums",
            "border bg-[var(--glass-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            "transition-colors focus:outline-none",
            preview.kind === "matched"
              ? "border-[var(--accent-gold)] focus:border-[var(--accent-gold)]"
              : preview.kind === "unknown"
                ? "border-[var(--accent-red)]/60 focus:border-[var(--accent-red)]"
                : "border-[var(--glass-border)] focus:border-[var(--accent-gold)]",
          )}
        />
        {value.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Kuponkód törlése"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2",
              "rounded-full p-1 text-[var(--text-muted)]",
              "transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            <XIcon size={13} />
          </button>
        )}
      </div>

      {/* Inline status */}
      {preview.kind === "matched" && (
        <p className="flex items-center gap-1.5 text-xs text-[var(--accent-gold)]">
          <Check size={12} strokeWidth={2.4} aria-hidden />
          {preview.coupon.name} —{" "}
          {formatDiscount(
            preview.coupon.discount_type,
            preview.coupon.discount_value,
          )}{" "}
          kedvezmény alkalmazva
        </p>
      )}
      {preview.kind === "unknown" && value.trim().length >= 4 && (
        <p className="text-xs text-[var(--accent-red)]">
          Ezt a kuponkódot nem találjuk a fiókodban. Ellenőrizd a kódot, vagy
          válts be új kupont a{" "}
          <Link
            href="/pont-aruhaz"
            className="underline underline-offset-2 hover:text-[var(--text-primary)]"
          >
            pont-áruházban
          </Link>
          .
        </p>
      )}

      {/* "Use one of yours" picker */}
      {showPicker && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Saját kuponjaid:
          </span>
          {usable.slice(0, 3).map((rc) => (
            <button
              key={rc.id}
              type="button"
              onClick={() => onPick(rc.code)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-display",
                "tracking-[0.16em] tabular-nums",
                "border-[var(--accent-gold)]/35 bg-[var(--accent-gold-subtle)]/40",
                "text-[var(--text-primary)] transition-colors",
                "hover:border-[var(--accent-gold)] hover:bg-[var(--accent-gold-subtle)]",
              )}
            >
              {rc.code}
            </button>
          ))}
          {usable.length > 3 && (
            <Link
              href="/kuponjaim"
              className="text-[11px] text-[var(--text-muted)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
            >
              +{usable.length - 3} további
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step badge
// ---------------------------------------------------------------------------

function StepBadge({
  index,
  active,
  done,
  label,
}: {
  index: number;
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
          "border",
          done && "border-[var(--accent-gold)] bg-[var(--accent-gold)] text-[#0a0e1a]",
          active &&
            "border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] text-[var(--accent-gold)]",
          !active &&
            !done &&
            "border-[var(--glass-border)] text-[var(--text-muted)]",
        )}
      >
        {done ? <Check size={14} strokeWidth={3} /> : index}
      </span>
      <span
        className={cn(
          "font-display uppercase tracking-[0.2em] text-xs",
          active
            ? "text-[var(--text-primary)]"
            : done
              ? "text-[var(--accent-gold)]"
              : "text-[var(--text-muted)]",
        )}
      >
        {label}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Field
// ---------------------------------------------------------------------------

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={cn(
          "w-full rounded-md px-3 py-2.5 text-sm",
          "border bg-[var(--glass-bg)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
          "transition-colors focus:outline-none",
          error
            ? "border-[var(--accent-red)] focus:border-[var(--accent-red)]"
            : "border-[var(--glass-border)] focus:border-[var(--accent-gold)]",
        )}
      />
      {error ? (
        <p className="text-xs text-[var(--accent-red)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
