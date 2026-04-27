"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Ticket as TicketIcon } from "lucide-react";
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
 * Visually treated as a stack of "digital tickets" — each Ticket row
 * gets its own card with the side-stub cutouts (negative-space dots
 * + perforation gradient) so it reads as a torn-off paper ticket
 * rather than another generic glass panel.
 *
 * Includes:
 *  - Top: success badge with the seat count.
 *  - Per-ticket card with seat number, sector, kickoff, ticket id snippet.
 *  - Footer: subtotal / discount / final total summary, optional warning
 *    if the coupon was rejected after the tickets were already minted,
 *    and CTAs to view "Saját jegyeim" or buy more.
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
      {/* Headline banner */}
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
      <div className="space-y-4">
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
// DigitalTicketCard — the visual centerpiece of the success screen
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
        "rounded-[var(--radius-lg)] border border-[var(--glass-border-hover)]",
        "bg-[var(--glass-bg-strong)] backdrop-blur-md",
        "shadow-[var(--shadow-md)]",
      )}
    >
      {/* Perforation gradient running down the middle "tear" line */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-3 z-[1]",
          "left-[68%] hidden md:block",
          "border-l border-dashed border-[var(--glass-border-hover)]",
        )}
      />
      {/* Side cutouts — half-circles eating into the top + bottom edges,
          giving the card a torn-paper silhouette. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-2 hidden md:block",
          "left-[calc(68%-8px)] size-4 rounded-full",
          "bg-[var(--bg-primary)]",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -bottom-2 hidden md:block",
          "left-[calc(68%-8px)] size-4 rounded-full",
          "bg-[var(--bg-primary)]",
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto]">
        {/* Main face */}
        <div className="space-y-5 p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
              FCB Digital Ticket #{String(index + 1).padStart(2, "0")}
            </p>
            <span
              className={cn(
                "rounded-full border border-[var(--glass-border)]",
                "bg-[var(--glass-bg)] px-2.5 py-0.5",
                "text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]",
              )}
            >
              {totalSeats} db rendelés
            </span>
          </div>

          <div className="space-y-1">
            <p className="font-display text-2xl leading-[1.05] tracking-wide text-[var(--text-primary)] sm:text-3xl">
              {match.home_team}
            </p>
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--text-muted)]">
              vs.
            </p>
            <p className="font-display text-2xl leading-[1.05] tracking-wide text-[var(--text-primary)] sm:text-3xl">
              {match.away_team}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1 sm:grid-cols-3">
            <DigitalDetail label="Mikor" value={formatTicketDate(match.date)} />
            <DigitalDetail label="Hol" value={match.venue ?? "—"} />
            <DigitalDetail label="Ár" value={formatPrice(Number(sector.price))} />
            <DigitalDetail label="Szektor" value={sector.sector_name} />
            <DigitalDetail label="Ülés" value={`#${ticket.seat_number}`} accent />
            <DigitalDetail label="Csoport" value={`Üléssor: ${allSeats}`} />
          </div>
        </div>

        {/* Right stub — barcode-style filler. */}
        <div
          className={cn(
            "relative flex flex-col items-center justify-between",
            "border-t border-dashed border-[var(--glass-border-hover)]",
            "bg-[var(--accent-blue)]/15 p-5",
            "md:min-w-[180px] md:border-l md:border-t-0",
          )}
        >
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
            Belépőkód
          </p>
          <BarcodePlaceholder seed={ticket.id} />
          <p className="text-center text-[10px] tracking-[0.18em] text-[var(--text-secondary)]">
            {shortId(ticket.id)}
          </p>
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
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-sm font-medium",
          accent
            ? "font-display text-base tracking-wide text-[var(--accent-gold)]"
            : "text-[var(--text-primary)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Deterministic "barcode" — generated from the ticket id so the same
 * ticket always renders the same stripes. Purely decorative; the real
 * scannable belépőkód lives in `Saját jegyeim` (F10) where it can be
 * re-issued on demand.
 */
function BarcodePlaceholder({ seed }: { seed: string }) {
  const stripes = useMemo(() => {
    const widths: number[] = [];
    let acc = 0;
    for (let i = 0; i < seed.length && i < 36; i += 1) {
      acc = (acc * 31 + seed.charCodeAt(i)) >>> 0;
      // 1 to 4 px wide — keeps the rhythm visually irregular but stable.
      widths.push((acc % 4) + 1);
    }
    return widths;
  }, [seed]);

  return (
    <div
      aria-hidden
      className="my-3 flex h-12 items-stretch gap-[2px]"
    >
      {stripes.map((w, i) => (
        <span
          key={i}
          style={{ width: `${w}px` }}
          className={cn(
            "block rounded-[1px]",
            i % 3 === 0
              ? "bg-[var(--text-primary)]"
              : "bg-[var(--text-secondary)]/70",
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
