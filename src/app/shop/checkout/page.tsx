"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ChevronRight, Sparkles } from "lucide-react";
import type { ShippingAddress } from "@/types/database";
import { createOrder } from "@/lib/shop-api";
import { useAuth } from "@/providers/AuthProvider";
import { useCart } from "@/providers/CartProvider";
import { useToast } from "@/providers/ToastProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

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
 * Step 1 — Shipping form + optional coupon code.  We collect the address
 *          locally; coupon validation is a future iteration (F13), so the
 *          field accepts free text and is purely visual here.
 *
 * Step 2 — Order summary with line items, totals, "Megrendelés (demo)"
 *          button.  On success we navigate to the success page; on
 *          failure we surface the error and stay on step 2 so the user
 *          can retry.
 *
 * The page is wrapped in `<ProtectedRoute>` because the underlying
 * `/api/orders` endpoint is auth-gated.
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
  const { profile } = useAuth();
  const toast = useToast();
  const { cartItems, cartTotal, cartCount, clearLocalCart } = useCart();

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>(
    {},
  );
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill the full name from the profile if we have one — small UX win.
  // Deferred via microtask so the setState is not synchronous in the effect.
  useEffect(() => {
    if (profile?.username && !form.full_name) {
      queueMicrotask(() =>
        setForm((prev) => ({ ...prev, full_name: profile.username ?? "" })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.username]);

  // If the cart empties (e.g. last item removed in a different tab),
  // bounce back to /shop with a friendly note.  We deliberately don't
  // do this if we're on step 2 mid-submit.
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
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
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

      const result = await createOrder({ shipping_address: shipping });
      if (result.warning) {
        toast.info(result.warning);
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

  const couponPreview = useMemo(() => {
    // Coupons are wired in F13 — for now we just echo a small visual hint
    // so the user knows the field is accepted.
    return form.coupon.trim().length > 0
      ? `Kupon mentve: ${form.coupon.trim().toUpperCase()} (érvényesítés a következő iterációban)`
      : null;
  }, [form.coupon]);

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

                <Field
                  id="coupon"
                  label="Kuponkód (nem kötelező)"
                  value={form.coupon}
                  onChange={(v) => setForm((p) => ({ ...p, coupon: v }))}
                  hint={couponPreview ?? undefined}
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
                  const price = product?.price ?? 0;
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
                      <span className="font-display text-sm tracking-wide text-[var(--accent-gold)]">
                        {formatPrice(price * item.quantity)}
                      </span>
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
                <dd className="text-[var(--text-primary)]">
                  {formatPrice(cartTotal)}
                </dd>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <dt>Szállítás</dt>
                <dd className="text-[var(--text-primary)]">Ingyenes</dd>
              </div>
              {form.coupon && (
                <div className="flex justify-between text-[var(--text-secondary)]">
                  <dt>Kupon</dt>
                  <dd className="text-[var(--text-primary)]">
                    {form.coupon.toUpperCase()}
                  </dd>
                </div>
              )}
              <hr className="my-3 border-[var(--glass-border)]" />
              <div className="flex items-baseline justify-between">
                <dt className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Végösszeg
                </dt>
                <dd className="font-display text-2xl tracking-wide text-[var(--accent-gold)]">
                  {formatPrice(cartTotal)}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
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
