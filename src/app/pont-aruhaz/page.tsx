"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Coins, Sparkles, Trophy } from "lucide-react";
import type { Coupon, RedeemedCoupon } from "@/types/database";
import {
  fetchActiveCoupons,
  redeemCoupon as redeemCouponApi,
} from "@/lib/coupons-api";
import { fetchPoints } from "@/lib/dashboard-api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  CouponCard,
  CouponCardSkeleton,
} from "@/components/coupons/CouponCard";
import { CouponCodeReveal } from "@/components/coupons/CouponCodeReveal";
import { CouponEmptyState } from "@/components/coupons/CouponEmptyState";
import { RedeemConfirmModal } from "@/components/coupons/RedeemConfirmModal";
import { cn } from "@/lib/utils";

/**
 * /pont-aruhaz — public point shop landing.
 *
 * Layout:
 *   - Header strip with eyebrow + title.
 *   - Balance hero (only for signed-in users; anons get a "join" CTA).
 *   - Coupon grid (responsive 1 / 2 / 3 columns).
 *   - Confirm modal -> redeem call -> code reveal modal flow.
 *
 * The page is intentionally NOT wrapped in `<ProtectedRoute>`: visitors
 * should be able to browse the catalog and decide to sign in. Only the
 * redeem CTA itself is gated.
 */
export default function PontAruhazPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [balance, setBalance] = useState<number | null>(null);
  const [totalEarned, setTotalEarned] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(false);

  const [pendingCoupon, setPendingCoupon] = useState<Coupon | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [revealedRedeemed, setRevealedRedeemed] =
    useState<RedeemedCoupon | null>(null);
  const [revealedCoupon, setRevealedCoupon] = useState<Coupon | null>(null);

  // ---------------------------------------------------------------------
  // Data — coupons (public) + balance (auth-gated). Both fired in parallel.
  // ---------------------------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const list = await fetchActiveCoupons(controller.signal);
        setCoupons(list);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        toast.error(
          err instanceof Error
            ? err.message
            : "Kuponok betöltése sikertelen",
        );
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [toast]);

  // Reload the balance when the auth state flips OR after a successful
  // redeem (the redeem handler bumps `user?.id`-driven dependencies via
  // `loadBalance` directly).
  useEffect(() => {
    if (!user?.id) {
      // Defer the reset out of the effect body so the rule against
      // synchronous setState-in-effects is honoured. See memory:
      // feedback_setstate_in_effect.
      queueMicrotask(() => {
        setBalance(null);
        setTotalEarned(null);
      });
      return;
    }
    const controller = new AbortController();
    void loadBalance(controller.signal);
    return () => controller.abort();
  }, [user?.id]);

  async function loadBalance(signal?: AbortSignal) {
    setBalanceLoading(true);
    try {
      const res = await fetchPoints(signal);
      setBalance(res.balance.balance);
      setTotalEarned(res.balance.total_earned);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      // Silent failure — the balance hero handles `null` gracefully.
    } finally {
      setBalanceLoading(false);
    }
  }

  // ---------------------------------------------------------------------
  // Redeem flow
  // ---------------------------------------------------------------------

  const onRequestRedeem = (coupon: Coupon) => {
    if (!user) {
      toast.info("A beváltáshoz jelentkezz be");
      return;
    }
    setPendingCoupon(coupon);
  };

  const onConfirmRedeem = async () => {
    if (!pendingCoupon) return;
    setRedeemingId(pendingCoupon.id);
    try {
      const result = await redeemCouponApi(pendingCoupon.id);
      // Hand the freshly-minted code to the reveal dialog, then close
      // the confirm modal so the celebration owns the screen.
      setRevealedRedeemed(result);
      setRevealedCoupon(pendingCoupon);
      setPendingCoupon(null);
      toast.points(`Kupon beváltva: ${pendingCoupon.name}`);
      // Refresh the balance so the hero reflects the spend.
      void loadBalance();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Beváltás sikertelen",
      );
    } finally {
      setRedeemingId(null);
    }
  };

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 sm:mb-8"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Pont-áruház
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-4xl sm:text-6xl",
          )}
        >
          Váltsd be a pontjaidat
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          A szavazásokon és más szurkolói tevékenységeken szerzett pontjaidat
          itt válthatod be a webshopban és jegyvásárláskor felhasználható
          kuponkódokra.
        </p>
      </motion.header>

      {/* Balance hero (or anonymous CTA) */}
      {user ? (
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05, ease: "easeOut" }}
          className={cn(
            "glass-card glass-border-gradient",
            "relative flex flex-col gap-5 overflow-hidden p-5 sm:p-7",
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/55 to-transparent"
          />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                Aktuális egyenleg
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <Coins
                  size={26}
                  className="text-[var(--accent-gold)]"
                  aria-hidden
                />
                <span
                  className={cn(
                    "font-display tabular-nums tracking-wide",
                    "text-5xl text-[var(--accent-gold)] sm:text-6xl",
                    "[text-shadow:0_0_28px_var(--accent-gold-subtle)]",
                  )}
                >
                  {balanceLoading || balance === null
                    ? "—"
                    : balance.toLocaleString("hu-HU")}
                </span>
                <span className="font-display text-base uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  pont
                </span>
              </div>
              {typeof totalEarned === "number" && (
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Életed során összesen{" "}
                  <span className="font-display tabular-nums tracking-wide text-[var(--text-primary)]">
                    {totalEarned.toLocaleString("hu-HU")}
                  </span>{" "}
                  pontot szereztél.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Link
                href="/szavazasok"
                className="glass-button-secondary whitespace-nowrap"
              >
                <Trophy size={14} aria-hidden />
                <span>Szerezz pontot</span>
              </Link>
              <Link
                href="/kuponjaim"
                className="glass-button-primary whitespace-nowrap"
              >
                <span>Kuponjaim</span>
                <ArrowUpRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </motion.section>
      ) : (
        <AnonymousHero />
      )}

      {/* Coupon grid */}
      <section className="mt-10 sm:mt-14">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="mb-5 flex items-end justify-between gap-4 sm:mb-6"
        >
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
              Elérhető kuponok
            </p>
            <h2 className="mt-0.5 font-display text-2xl tracking-wide text-[var(--text-primary)] sm:text-[1.6rem]">
              Válaszd ki a tied
            </h2>
          </div>
          {!loading && coupons.length > 0 && (
            <span className="font-display text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {coupons.length} kupon
            </span>
          )}
        </motion.div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CouponCardSkeleton key={i} />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <CouponEmptyState
            title="Most nincs elérhető kupon"
            description="A pont-áruház hamarosan friss kínálattal tér vissza. Addig is gyűjts pontokat a szavazásokon!"
            cta={{ href: "/szavazasok", label: "Irány a szavazások" }}
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {coupons.map((c, i) => (
              <CouponCard
                key={c.id}
                coupon={c}
                index={i}
                userBalance={user ? balance ?? undefined : undefined}
                isAnonymous={!user}
                isRedeeming={redeemingId === c.id}
                onRedeem={onRequestRedeem}
              />
            ))}
          </div>
        )}
      </section>

      {/* Modals */}
      <RedeemConfirmModal
        coupon={pendingCoupon}
        userBalance={balance ?? 0}
        isSubmitting={redeemingId !== null}
        onCancel={() => setPendingCoupon(null)}
        onConfirm={onConfirmRedeem}
      />
      <CouponCodeReveal
        redeemed={revealedRedeemed}
        coupon={revealedCoupon}
        onClose={() => {
          setRevealedRedeemed(null);
          setRevealedCoupon(null);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Anonymous hero — replaces the balance card for visitors.
// ---------------------------------------------------------------------------

function AnonymousHero() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.05, ease: "easeOut" }}
      className={cn(
        "glass-card relative flex flex-col gap-4 overflow-hidden p-6",
        "sm:flex-row sm:items-center sm:justify-between sm:p-7",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
            "border border-[var(--accent-gold)]/35",
            "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)]",
          )}
          aria-hidden
        >
          <Sparkles size={20} />
        </span>
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.28em] text-[var(--accent-gold)]">
            Csatlakozz
          </p>
          <h2 className="mt-1 font-display text-xl tracking-wide text-[var(--text-primary)] sm:text-2xl">
            Lépj be, hogy beválthasd a pontjaidat
          </h2>
          <p className="mt-1 max-w-lg text-sm text-[var(--text-secondary)]">
            A kuponokat csak bejelentkezett szurkolók válthatják be. Hozz létre
            egy fiókot, és kezdj el pontot gyűjteni a szavazásokon.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        <Link href="/login?returnUrl=/pont-aruhaz" className="glass-button-secondary">
          Bejelentkezés
        </Link>
        <Link
          href="/register?returnUrl=/pont-aruhaz"
          className="glass-button-primary"
        >
          Regisztráció
        </Link>
      </div>
    </motion.section>
  );
}
