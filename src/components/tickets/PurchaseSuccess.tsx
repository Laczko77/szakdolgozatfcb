"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, QrCode, Ticket as TicketIcon } from "lucide-react";
import type { Match, Ticket } from "@/types/database";
import type { SectorWithAvailability } from "@/lib/tickets-api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PurchaseSuccessProps {
  match: Match;
  sector: SectorWithAvailability;
  tickets: Ticket[];
  subtotal: number;
  total: number;
  coupon: { code: string; discount: number } | null;
  warning?: string;
  onBuyAgain: () => void;
}

/**
 * Confirmation screen rendered when `/api/tickets/purchase` resolves.
 *
 * The visual centrepiece is the {@link DigitalTicketCard} — a black,
 * gold-bordered "torn paper" card laid out exactly like a physical match
 * ticket: club lockup top-left, ÉRVÉNYES BELÉPŐ caption, perforated tear
 * line down the right side, and a square QR placeholder on the stub. This
 * replaces the prior glass-panel treatment so the success screen reads
 * instantly as "you have a ticket" rather than "your transaction worked".
 */
export function PurchaseSuccess({
  match,
  sector,
  tickets,
  subtotal,
  total,
  coupon,
  warning,
  onBuyAgain,
}: PurchaseSuccessProps) {
  const seatNumbers = tickets
    .map((t) => t.seat_number)
    .sort((a, b) => a - b)
    .join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="space-y-8"
    >
      {/* Headline banner — stays glass to anchor the celebration */}
      <div className="relative overflow-hidden glass-card-strong p-7 text-center sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)] to-transparent"
        />
        <div
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full",
            "border border-[var(--accent-gold)] bg-[var(--accent-gold)]/10",
            "text-[var(--accent-gold)] cta-pulse",
          )}
        >
          <CheckCircle2 size={26} />
        </div>

        <p className="mt-5 font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Sikeres jegyvásárlás
        </p>
        <h1 className="mt-2 font-display text-3xl leading-tight tracking-wide text-[var(--text-primary)] sm:text-4xl">
          {tickets.length === 1
            ? "1 jegy a tárcádban"
            : `${tickets.length} jegy a tárcádban`}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--text-secondary)]">
          A vásárolt jegyek bármikor elérhetők a „Saját jegyeim” oldalon.
          Mutasd be a kódot a beléptetésnél.
        </p>

        {warning && (
          <p
            role="alert"
            className={cn(
              "mx-auto mt-4 max-w-md rounded-[var(--radius-md)]",
              "border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10",
              "px-4 py-2 text-xs text-[var(--accent-red)]",
            )}
          >
            {warning}
          </p>
        )}
      </div>

      {/* Stacked digital tickets */}
      <div className="space-y-5">
        {tickets.map((ticket, i) => (
          <DigitalTicketCard
            key={ticket.id}
            ticket={ticket}
            match={match}
            sector={sector}
            index={i}
            allSeats={seatNumbers}
            totalSeats={tickets.length}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="glass-card p-6 sm:p-7">
        <h3 className="font-display text-sm uppercase tracking-[0.32em] text-[var(--text-muted)]">
          Összegzés
        </h3>
        <dl className="mt-4 space-y-2.5">
          <SummaryRow
            label={`${tickets.length} × ${sector.sector_name} szektor`}
            value={formatPrice(subtotal)}
          />
          {coupon && (
            <SummaryRow
              label={`Kupon: ${coupon.code}`}
              value={`− ${formatPrice(coupon.discount)}`}
              tone="discount"
            />
          )}
          <div className="my-2 h-px bg-[var(--glass-border)]" />
          <SummaryRow
            label="Fizetendő"
            value={formatPrice(total)}
            tone="total"
          />
        </dl>
      </div>

      {/* CTAs */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
        <Link href="/jegyeim" className="glass-button-primary">
          <TicketIcon size={14} aria-hidden />
          <span>Saját jegyeim</span>
        </Link>
        <button
          type="button"
          onClick={onBuyAgain}
          className="glass-button-secondary"
        >
          Tovább vásárolok
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// DigitalTicketCard — physical-feeling jegy
// ---------------------------------------------------------------------------

interface DigitalTicketCardProps {
  ticket: Ticket;
  match: Match;
  sector: SectorWithAvailability;
  index: number;
  /** Comma-separated seat numbers across the whole order. */
  allSeats: string;
  totalSeats: number;
}

function DigitalTicketCard({
  ticket,
  match,
  sector,
  index,
  allSeats,
  totalSeats,
}: DigitalTicketCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{
        duration: 0.55,
        delay: 0.1 + Math.min(index * 0.08, 0.5),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "relative overflow-hidden",
        "rounded-[var(--radius-lg)] border-2 border-[var(--accent-gold)]",
        // Solid black ticket body — independent of dark/light theme so the
        // jegy reads correctly on both. Light theme would otherwise wash
        // the gold accent against the cream page.
        "bg-[#0a0d18]",
        "shadow-[0_18px_44px_-16px_rgba(0,0,0,0.65),0_0_28px_-4px_rgba(196,163,77,0.18)]",
      )}
    >
      {/* Background ⚽ watermark — large, faint Bebas Neue letters spelling FCB */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span className="font-display text-[12rem] tracking-[0.4em] text-[var(--accent-gold)]/[0.04] sm:text-[16rem]">
          FCB
        </span>
      </div>

      {/* Half-circle cutouts that "tear" the ticket along the perforation */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute hidden md:block",
          "left-[calc(72%-9px)] -top-2 size-4 rounded-full bg-[var(--bg-primary)]",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute hidden md:block",
          "left-[calc(72%-9px)] -bottom-2 size-4 rounded-full bg-[var(--bg-primary)]",
        )}
      />

      <div className="relative grid grid-cols-1 md:grid-cols-[1fr_auto]">
        {/* MAIN FACE */}
        <div className="space-y-5 p-6 sm:p-7">
          {/* Top row — club lockup + ticket index */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  "border border-[var(--accent-gold)] bg-[var(--accent-gold)]/10",
                  "font-display text-base text-[var(--accent-gold)]",
                )}
              >
                ⚽
              </span>
              <span className="font-display text-[11px] uppercase tracking-[0.42em] text-white/85">
                FC Barcelona
              </span>
            </div>
            <span
              className={cn(
                "rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-0.5",
                "text-[10px] uppercase tracking-[0.18em] text-white/70",
              )}
            >
              {String(index + 1).padStart(2, "0")} / {String(totalSeats).padStart(2, "0")}
            </span>
          </div>

          {/* Ticket headline — VALID ENTRY */}
          <p className="font-display text-[10px] uppercase tracking-[0.55em] text-[var(--accent-gold)]">
            Érvényes belépő
          </p>

          {/* Match line */}
          <h3 className="font-display text-2xl leading-[1.05] tracking-wide text-white sm:text-[1.75rem]">
            {match.home_team}
            <span className="mx-2 text-[var(--accent-gold)]">vs.</span>
            {match.away_team}
          </h3>

          {/* Detail grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-1 sm:grid-cols-3">
            <DigitalDetail label="Mikor" value={formatTicketDate(match.date)} />
            <DigitalDetail label="Hol" value={match.venue ?? "—"} />
            <DigitalDetail label="Ár" value={formatPrice(Number(sector.price))} />
            <DigitalDetail label="Szektor" value={sector.sector_name} />
            <DigitalDetail label="Ülés" value={`#${ticket.seat_number}`} accent />
            <DigitalDetail label="Csoport" value={`Üléssor: ${allSeats}`} />
          </div>

          {/* Bottom legalese — always last */}
          <p className="border-t border-white/10 pt-3 text-[10px] uppercase tracking-[0.22em] text-white/50">
            FC Barcelona · Demo bemutató · Nem átruházható
          </p>
        </div>

        {/* RIGHT STUB — perforated, with QR placeholder */}
        <div
          className={cn(
            "relative flex flex-col items-center justify-between gap-4",
            "border-t-2 border-dashed border-[var(--accent-gold)]/45 p-5",
            "bg-[var(--accent-gold)]/[0.04]",
            "md:min-w-[180px] md:border-l-2 md:border-t-0",
          )}
        >
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Belépőkód
          </p>

          {/* QR placeholder — checkered grid for plausible pixelated look */}
          <div
            role="img"
            aria-label="QR kód helyőrző"
            className={cn(
              "relative flex size-20 shrink-0 items-center justify-center",
              "rounded-md border border-white/15 bg-white/[0.06]",
            )}
          >
            <QrCheckerboard seed={ticket.id} />
            <QrCode
              size={26}
              className="absolute text-white/40"
              aria-hidden
            />
          </div>

          <div className="text-center">
            <p className="font-display text-[10px] uppercase tracking-[0.28em] text-white/55">
              Azonosító
            </p>
            <p className="mt-1 font-mono text-[11px] tracking-[0.18em] text-white/85">
              {shortId(ticket.id)}
            </p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function DigitalDetail({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase tracking-[0.28em] text-white/45">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-sm font-medium",
          accent
            ? "font-display text-base tracking-wide text-[var(--accent-gold)]"
            : "text-white/95",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Decorative QR-style 5x5 checkerboard. Purely visual — the real entry code
 * lives on `Saját jegyeim`. The pattern is seeded by the ticket id so the
 * same ticket renders the same arrangement, which makes screenshots feel
 * stable across re-renders.
 */
function QrCheckerboard({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const out: boolean[] = [];
    let acc = 0;
    for (let i = 0; i < 25; i += 1) {
      acc = (acc * 31 + (seed.charCodeAt(i % seed.length) || 0)) >>> 0;
      out.push((acc & 1) === 0);
    }
    return out;
  }, [seed]);

  return (
    <div
      aria-hidden
      className="absolute inset-1.5 grid grid-cols-5 grid-rows-5 gap-[2px]"
    >
      {cells.map((on, i) => (
        <span
          key={i}
          className={cn(
            "rounded-[1px]",
            on ? "bg-white/25" : "bg-transparent",
          )}
        />
      ))}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "discount" | "total";
}) {
  const accent =
    tone === "total"
      ? "font-display text-xl text-[var(--accent-gold)]"
      : tone === "discount"
        ? "text-emerald-400"
        : "text-[var(--text-primary)]";
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className={cn("tabular-nums text-sm", accent)}>{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTicketDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const datePart = new Intl.DateTimeFormat("hu-HU", {
    month: "short",
    day: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${datePart} · ${timePart}`;
}

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 12).toUpperCase();
}
