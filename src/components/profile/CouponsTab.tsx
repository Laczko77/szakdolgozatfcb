"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, ShoppingBag, Ticket } from "lucide-react";
import type { RedeemedCouponWithDef } from "@/lib/coupons-api";
import { RedeemedCouponCard } from "@/components/coupons/RedeemedCouponCard";
import { CouponEmptyState } from "@/components/coupons/CouponEmptyState";
import { cn } from "@/lib/utils";

/**
 * /profil → Kuponjaim tab.
 *
 * Same structure as the standalone /kuponjaim page, just embedded in the
 * profile shell — re-uses `RedeemedCouponCard` so the ticket-cut visual
 * stays consistent across both surfaces.
 */

interface CouponsTabProps {
  coupons: RedeemedCouponWithDef[];
  loading: boolean;
}

export function CouponsTab({ coupons, loading }: CouponsTabProps) {
  const { active, used } = useMemo(() => {
    return {
      active: coupons.filter((c) => !c.is_used),
      used: coupons.filter((c) => c.is_used),
    };
  }, [coupons]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    );
  }

  if (coupons.length === 0) {
    return (
      <CouponEmptyState
        title="Még nincs kuponod"
        description="Váltsd be a pontjaidat a pont-áruházban — a kuponkódjaid itt fognak megjelenni."
        cta={{ href: "/pont-aruhaz", label: "Irány a pont-áruház" }}
      />
    );
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          {active.length > 0
            ? `${active.length} aktív kuponod van — a kódokat a webshop és jegyvásárlás pénztárában használhatod.`
            : "Az aktív kódjaid alább jelennek meg, ha új kupont váltasz be."}
        </p>
        <Link
          href="/pont-aruhaz"
          className="glass-button-secondary whitespace-nowrap"
        >
          <span>Pont-áruház</span>
          <ArrowUpRight size={14} aria-hidden />
        </Link>
      </header>

      <Section
        eyebrow="Aktív"
        title="Készen áll a beváltásra"
        icon={Ticket}
        count={active.length}
      >
        {active.length === 0 ? (
          <CouponEmptyState
            variant="compact"
            title="Most nincs aktív kuponod"
            description="A korábban beváltott kódjaidat alább találod. Új kuponokért irány a pont-áruház."
            cta={{ href: "/pont-aruhaz", label: "Pont-áruház" }}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((rc, i) => (
              <RedeemedCouponCard key={rc.id} redeemed={rc} index={i} />
            ))}
          </div>
        )}
      </Section>

      {used.length > 0 && (
        <Section
          eyebrow="Felhasznált"
          title="Korábbi beváltások"
          icon={ShoppingBag}
          count={used.length}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {used.map((rc, i) => (
              <RedeemedCouponCard key={rc.id} redeemed={rc} index={i} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  icon: Icon,
  count,
  children,
}: {
  eyebrow: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3 sm:mb-5">
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
            <h3 className="font-display text-xl tracking-wide text-[var(--text-primary)] sm:text-[1.45rem]">
              {title}
            </h3>
          </div>
        </div>
        <span className="font-display text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {count} db
        </span>
      </div>
      {children}
    </section>
  );
}
