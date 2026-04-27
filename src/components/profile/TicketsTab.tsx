"use client";

import Link from "next/link";
import { Ticket as TicketIcon } from "lucide-react";
import type { MyTicketsResponse } from "@/lib/tickets-api";
import { MyTicketCard } from "@/components/tickets/MyTicketCard";
import { cn } from "@/lib/utils";

/**
 * /profil → Jegyeim tab.
 *
 * Wraps the existing F9 `MyTicketCard` so the visual language stays
 * identical between the standalone /jegyeim page and the profile tab.
 * Two sections: közelgő (kiemelt) + lejátszott (halványabb).
 */

interface TicketsTabProps {
  data: MyTicketsResponse;
  loading: boolean;
}

export function TicketsTab({ data, loading }: TicketsTabProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            className="glass-card h-[140px] animate-pulse"
          />
        ))}
      </div>
    );
  }

  const total = data.upcoming.length + data.past.length;

  if (total === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-4 p-10 text-center sm:p-14">
        <div
          aria-hidden
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            "text-[var(--accent-gold)]",
          )}
        >
          <TicketIcon size={22} />
        </div>
        <h3 className="font-display text-2xl tracking-wide text-[var(--text-primary)]">
          Még nincs jegyed
        </h3>
        <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
          Vásárolj jegyet bármelyik közelgő mérkőzésre, és itt automatikusan
          megjelenik a digitális jegyed.
        </p>
        <Link href="/jegyek" className="glass-button-primary mt-2">
          <TicketIcon size={14} aria-hidden />
          <span>Mérkőzések böngészése</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {data.upcoming.length > 0 && (
        <Section title="Közelgő mérkőzések" count={data.upcoming.length}>
          <div className="space-y-3">
            {data.upcoming.map((t, i) => (
              <MyTicketCard
                key={t.id}
                ticket={t}
                index={i}
                variant="upcoming"
              />
            ))}
          </div>
        </Section>
      )}

      {data.past.length > 0 && (
        <Section title="Lejátszott mérkőzések" count={data.past.length}>
          <div className="space-y-3">
            {data.past.map((t, i) => (
              <MyTicketCard key={t.id} ticket={t} index={i} variant="past" />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base uppercase tracking-[0.32em] text-[var(--text-primary)] sm:text-lg">
          {title}
        </h2>
        <span
          className={cn(
            "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            "px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]",
          )}
        >
          {count} db
        </span>
      </header>
      {children}
    </section>
  );
}
