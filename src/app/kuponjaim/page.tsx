"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ShoppingBag, Ticket } from "lucide-react";
import { fetchMyCoupons, type RedeemedCouponWithDef } from "@/lib/coupons-api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { CouponEmptyState } from "@/components/coupons/CouponEmptyState";
import { RedeemedCouponCard } from "@/components/coupons/RedeemedCouponCard";
import { cn } from "@/lib/utils";

/**
 * /kuponjaim — the user's redeemed coupon vault.
 *
 * Standalone destination until F10 builds the full /profil shell with tabs.
 * Same pattern as /pontjaim from F12: F10 will simply reuse this page's
 * structure as a profile tab.
 *
 * Layout:
 *   - Header strip
 *   - Active section (kiemelt) — copies + status
 *   - Used section (halványabb) — code line-through, "Felhasználva" stripe
 */
export default function KuponjaimPage() {
  return (
    <ProtectedRoute>
      <KuponjaimContent />
    </ProtectedRoute>
  );
}

function KuponjaimContent() {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<RedeemedCouponWithDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const list = await fetchMyCoupons({ signal: controller.signal });
        setItems(list);
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
  }, [user?.id, toast]);

  const { active, used } = useMemo(() => {
    const active = items.filter((i) => !i.is_used);
    const used = items.filter((i) => i.is_used);
    return { active, used };
  }, [items]);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 sm:mb-8"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Kuponjaim
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h1
            className={cn(
              "font-display leading-none tracking-wider",
              "text-[var(--text-primary)] text-4xl sm:text-6xl",
            )}
          >
            Kuponjaim
          </h1>
          <Link
            href="/pont-aruhaz"
            className="glass-button-secondary whitespace-nowrap"
          >
            <span>Pont-áruház</span>
            <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          Itt találod minden eddig beváltott kuponodat. Az aktív kódokat
          felhasználhatod a webshop és a jegyvásárlás pénztárában.
        </p>
      </motion.header>

      {/* Stats strip */}
      {!loading && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
          className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <StatTile
            label="Összes kupon"
            value={items.length.toLocaleString("hu-HU")}
          />
          <StatTile
            label="Aktív"
            value={active.length.toLocaleString("hu-HU")}
            tone="gold"
          />
          <StatTile
            label="Felhasznált"
            value={used.length.toLocaleString("hu-HU")}
            tone="muted"
          />
        </motion.div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              aria-hidden
              className={cn(
                "h-[210px] animate-pulse rounded-[var(--radius-lg)]",
                "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
              )}
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <CouponEmptyState
          title="Még nincs kuponod"
          description="Váltsd be a pontjaidat a pont-áruházban — a kuponkódjaid itt fognak megjelenni."
          cta={{ href: "/pont-aruhaz", label: "Irány a pont-áruház" }}
        />
      ) : (
        <div className="space-y-12">
          {/* Active */}
          <section>
            <SectionHeader
              eyebrow="Aktív"
              title="Készen áll a beváltásra"
              count={active.length}
              icon={Ticket}
            />
            {active.length === 0 ? (
              <CouponEmptyState
                variant="compact"
                title="Most nincs aktív kuponod"
                description="A korábban beváltott kódjaidat alább találod. Az új kuponokért irány a pont-áruház."
                cta={{ href: "/pont-aruhaz", label: "Pont-áruház" }}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((rc, i) => (
                  <RedeemedCouponCard
                    key={rc.id}
                    redeemed={rc}
                    index={i}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Used */}
          {used.length > 0 && (
            <section>
              <SectionHeader
                eyebrow="Felhasznált"
                title="Korábbi beváltások"
                count={used.length}
                icon={ShoppingBag}
              />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {used.map((rc, i) => (
                  <RedeemedCouponCard
                    key={rc.id}
                    redeemed={rc}
                    index={i}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  eyebrow,
  title,
  count,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  count: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mb-4 flex items-end justify-between gap-3 sm:mb-5"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            "border border-[var(--glass-border-hover)] bg-[var(--glass-bg)]",
            "text-[var(--accent-gold)]",
          )}
        >
          <Icon size={15} />
        </span>
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
          <h2 className="font-display text-xl tracking-wide text-[var(--text-primary)] sm:text-[1.45rem]">
            {title}
          </h2>
        </div>
      </div>
      <span className="font-display text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {count} db
      </span>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "gold" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)] px-4 py-3.5",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 font-display text-2xl tabular-nums tracking-wide",
          tone === "gold" && "text-[var(--accent-gold)]",
          tone === "muted" && "text-[var(--text-muted)]",
          tone === "default" && "text-[var(--text-primary)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}
