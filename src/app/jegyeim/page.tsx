"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Ticket as TicketIcon } from "lucide-react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useToast } from "@/providers/ToastProvider";
import {
  fetchMyTickets,
  type MyTicketsResponse,
} from "@/lib/tickets-api";
import { MyTicketCard } from "@/components/tickets/MyTicketCard";
import { cn } from "@/lib/utils";

/**
 * /jegyeim — the caller's ticket wallet.
 *
 * Auth-gated: rendered inside {@link ProtectedRoute} so anonymous users
 * are bounced to /login with the right `returnUrl`.
 *
 * Data: a single fetch to /api/tickets — the backend already partitions
 * the response into `upcoming` and `past`, so we render two sections
 * directly without any client-side bucketing.
 *
 * The page is intentionally minimal — F10's "Profil → Jegyeim" tab is
 * where the richer wallet UX lives. This page exists so users have a
 * direct destination to land on after a successful purchase (the
 * `Saját jegyeim` CTA on `PurchaseSuccess`).
 */

export default function MyTicketsPage() {
  return (
    <ProtectedRoute>
      <MyTicketsContent />
    </ProtectedRoute>
  );
}

function MyTicketsContent() {
  const toast = useToast();
  const [data, setData] = useState<MyTicketsResponse>({
    upcoming: [],
    past: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    // Async IIFE — keeps setLoading out of the synchronous effect body so
    // eslint-config-next stops flagging cascading-render risk.
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchMyTickets(controller.signal);
        if (controller.signal.aborted) return;
        setData(res);
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Jegyek betöltése sikertelen",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [toast]);

  const total = data.upcoming.length + data.past.length;

  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="space-y-3"
      >
        <p className="font-display text-[11px] uppercase tracking-[0.5em] text-[var(--accent-gold)]">
          Tárcám
        </p>
        <h1 className="font-display text-5xl leading-[0.95] tracking-wide text-[var(--text-primary)] sm:text-6xl">
          Saját jegyeim
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {loading
            ? "Jegyek betöltése folyamatban…"
            : total === 0
              ? "Még nincs vásárolt jegyed."
              : `Összesen ${total} jegy a tárcádban.`}
        </p>
      </motion.header>

      {loading ? (
        <Skeleton />
      ) : total === 0 ? (
        <EmptyWallet />
      ) : (
        <div className="mt-10 space-y-12">
          {data.upcoming.length > 0 && (
            <Section title="Közelgő mérkőzések" count={data.upcoming.length}>
              <div className="space-y-3">
                {data.upcoming.map((ticket, i) => (
                  <MyTicketCard
                    key={ticket.id}
                    ticket={ticket}
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
                {data.past.map((ticket, i) => (
                  <MyTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    index={i}
                    variant="past"
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </main>
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
        <h2 className="font-display text-xl uppercase tracking-[0.32em] text-[var(--text-primary)]">
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

function Skeleton() {
  return (
    <div className="mt-10 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="glass-card h-[140px] animate-pulse"
          aria-hidden
        />
      ))}
    </div>
  );
}

function EmptyWallet() {
  return (
    <div className="mt-10 glass-card flex flex-col items-center gap-4 p-10 text-center sm:p-14">
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
        Vásárolj jegyet bármelyik közelgő mérkőzésre és itt automatikusan
        megjelenik a digitális jegyed.
      </p>
      <Link href="/jegyek" className="glass-button-primary mt-2">
        <TicketIcon size={14} aria-hidden />
        <span>Mérkőzések böngészése</span>
      </Link>
    </div>
  );
}
