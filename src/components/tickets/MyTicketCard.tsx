"use client";

import { motion } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";
import type { TicketWithRelations } from "@/lib/tickets-api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TeamCrest } from "./TeamCrest";

interface MyTicketCardProps {
  ticket: TicketWithRelations;
  /** Drives the staggered list reveal. */
  index?: number;
  /** Past tickets are visually de-emphasised. */
  variant?: "upcoming" | "past";
}

/**
 * Compact "wallet" card for the `/jegyeim` listing.
 *
 * Trimmed-down version of {@link DigitalTicketCard} from the success
 * screen — same torn-paper silhouette, but every ticket is a single row
 * (no stacked perforations, no barcode stub) so the listing scans like
 * a transaction history.
 *
 * Past tickets render at 70% opacity with the gold accent dimmed so the
 * eye gravitates to upcoming entries first.
 */
export function MyTicketCard({
  ticket,
  index = 0,
  variant = "upcoming",
}: MyTicketCardProps) {
  const sector = ticket.sector;
  const match = sector?.match ?? null;
  const isPast = variant === "past";

  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: Math.min(index * 0.05, 0.3),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] p-5 sm:p-6",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md",
        "transition-colors duration-300",
        isPast ? "opacity-70" : "hover:bg-[var(--glass-bg-hover)]",
      )}
    >
      {/* Left edge accent — gold for upcoming, muted for past */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full",
          isPast ? "bg-[var(--text-muted)]/40" : "bg-[var(--accent-gold)]",
        )}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="space-y-3">
          <p
            className={cn(
              "font-display text-[10px] uppercase tracking-[0.32em]",
              isPast
                ? "text-[var(--text-muted)]"
                : "text-[var(--accent-gold)]",
            )}
          >
            {isPast ? "Lejátszott" : "Közelgő"} mérkőzés
          </p>

          {match ? (
            <h3 className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-display text-xl tracking-wide text-[var(--text-primary)] sm:text-2xl">
              <span className="inline-flex items-center gap-2 min-w-0">
                <TeamCrest
                  url={match.home_team_crest}
                  teamName={match.home_team}
                  size={28}
                />
                <span className="truncate">{match.home_team}</span>
              </span>
              <span className="font-display text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
                vs.
              </span>
              <span className="inline-flex items-center gap-2 min-w-0">
                <TeamCrest
                  url={match.away_team_crest}
                  teamName={match.away_team}
                  size={28}
                />
                <span className="truncate">{match.away_team}</span>
              </span>
            </h3>
          ) : (
            <h3 className="font-display text-xl tracking-wide text-[var(--text-primary)] sm:text-2xl">
              Ismeretlen mérkőzés
            </h3>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} aria-hidden />
              {match
                ? formatFullDate(match.date)
                : formatFullDate(ticket.purchased_at)}
            </span>
            {match?.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} aria-hidden />
                {match.venue}
              </span>
            )}
          </div>
        </div>

        {/* Seat / sector summary */}
        <div
          className={cn(
            "flex flex-col items-start gap-3 rounded-[var(--radius-md)]",
            "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] p-4",
            "sm:flex-row sm:items-center sm:gap-6",
          )}
        >
          <Detail
            label="Szektor"
            value={sector?.sector_name ?? "—"}
          />
          <Detail
            label="Ülés"
            value={`#${ticket.seat_number}`}
            accent={!isPast}
          />
          {sector && (
            <Detail
              label="Ár"
              value={formatPrice(Number(sector.price))}
            />
          )}
        </div>
      </div>
    </motion.article>
  );
}

function Detail({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-medium",
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

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
