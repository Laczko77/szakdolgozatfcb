"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ShoppingBag, User } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { SuccessConfetti } from "@/components/shop/SuccessConfetti";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Order success page (/shop/checkout/success).
 *
 * Reachable only via redirect from the checkout flow with the new order
 * id in the query string.  We treat the URL as the source of truth: if
 * the user lands here directly without an id we send them back to /shop
 * after a brief flash so the feedback isn't a confusing dead-end.
 */
export default function CheckoutSuccessPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <SuccessContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const reduced = useReducedMotion();
  const orderId = params.get("orderId");

  useEffect(() => {
    if (!orderId) {
      const t = setTimeout(() => router.replace("/shop"), 1200);
      return () => clearTimeout(t);
    }
  }, [orderId, router]);

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-120px)] max-w-2xl flex-col items-center justify-center px-4 py-12 text-center">
      <SuccessConfetti />

      {/* Big checkmark — animated stroke */}
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{
          duration: 0.6,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className={cn(
          "relative z-10 flex h-24 w-24 items-center justify-center rounded-full",
          "border-2 border-[var(--accent-gold)]",
          "bg-[var(--glass-bg-strong)] backdrop-blur-md",
          "shadow-[var(--shadow-glow-gold)]",
        )}
      >
        <Check
          size={48}
          strokeWidth={2.5}
          className="text-[var(--accent-gold)] success-check"
        />
      </motion.div>

      <motion.h1
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="relative z-10 mt-6 font-display text-4xl leading-tight tracking-wider text-[var(--text-primary)] sm:text-5xl"
      >
        Köszönjük a rendelést!
      </motion.h1>

      <motion.p
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="relative z-10 mt-4 max-w-md text-sm text-[var(--text-secondary)] sm:text-base"
      >
        Rendelésedet sikeresen leadtuk. A részleteket bármikor megtalálod a
        profilodban a &quot;Rendeléseim&quot; fül alatt.
      </motion.p>

      {orderId && (
        <motion.p
          initial={reduced ? { opacity: 0 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10 mt-3 font-mono text-xs text-[var(--text-muted)]"
        >
          Rendelési azonosító: {orderId.slice(0, 8)}…
        </motion.p>
      )}

      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="relative z-10 mt-8 flex flex-wrap justify-center gap-3"
      >
        <Link href="/profil" className="glass-button-primary">
          <User size={14} />
          Rendeléseim
        </Link>
        <Link href="/shop" className="glass-button-secondary">
          <ShoppingBag size={14} />
          Tovább vásárolok
        </Link>
      </motion.div>

      <style jsx>{`
        :global(.success-check) {
          stroke-dasharray: 80;
          stroke-dashoffset: 80;
          animation: check-draw 0.7s 0.2s ease-out forwards;
        }
        @keyframes check-draw {
          to {
            stroke-dashoffset: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.success-check) {
            animation: none;
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
