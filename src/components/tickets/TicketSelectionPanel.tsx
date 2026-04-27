"use client";

import { useMemo, useState } from "react";
import { Loader2, Ticket as TicketIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import type { SectorWithAvailability } from "@/lib/tickets-api";

interface TicketSelectionPanelProps {
  selectedSector: SectorWithAvailability | null;
  /** Submitted with the purchase request when present. */
  onPurchase: (input: { quantity: number; couponCode: string | null }) => void;
  /** Set to true while the parent is awaiting the API response. */
  isSubmitting?: boolean;
  className?: string;
}

const HARD_MAX = 4;

/**
 * Right-rail panel paired with the stadium map.
 *
 * Responsibilities:
 *  - Reflect the currently selected sector (name, free seats, price/jegy).
 *  - Quantity stepper, clamped to `min(HARD_MAX=4, available_seats)`.
 *  - Optional coupon code input — passed through verbatim to the
 *    `/api/tickets/purchase` endpoint, which owns the validation.
 *  - Live price summary (price × quantity) before any coupon discount is
 *    applied — the actual discount is computed server-side and surfaced
 *    in the success screen.
 *  - "Jegyvásárlás (demo)" CTA. The button is disabled until a sector
 *    is selected AND the quantity is at least 1, so the user never
 *    submits an invalid request.
 *
 * The panel auto-clamps the quantity when the user switches to a sector
 * with fewer free seats — better than showing a stale "4" against a
 * sector that only has 1 ticket left.
 */
export function TicketSelectionPanel({
  selectedSector,
  onPurchase,
  isSubmitting = false,
  className,
}: TicketSelectionPanelProps) {
  const [rawQuantity, setQuantity] = useState(1);
  const [couponCode, setCouponCode] = useState("");

  const maxQty = useMemo(() => {
    if (!selectedSector) return HARD_MAX;
    return Math.max(1, Math.min(HARD_MAX, selectedSector.available_seats));
  }, [selectedSector]);

  // Derived clamp on render — avoids a setState-in-effect that
  // eslint-config-next forbids under React 19. The internal state is
  // free to drift above the new maxQty when the user switches sectors,
  // but the value we render and submit is always clamped first.
  const quantity = Math.min(Math.max(1, rawQuantity), maxQty);

  const subtotal = selectedSector
    ? Number(selectedSector.price) * quantity
    : 0;
  const canBuy =
    !!selectedSector &&
    !selectedSector.is_sold_out &&
    quantity >= 1 &&
    quantity <= maxQty &&
    !isSubmitting;

  return (
    <aside
      className={cn(
        "glass-card relative overflow-hidden p-6 sm:p-7",
        className,
      )}
    >
      <header className="space-y-1.5">
        <p className="font-display text-[11px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
          Jegyválasztó
        </p>
        <h2 className="font-display text-2xl tracking-wide text-[var(--text-primary)]">
          {selectedSector
            ? `${selectedSector.sector_name} szektor`
            : "Válassz szektort"}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {selectedSector
            ? selectedSector.is_sold_out
              ? "Ez a szektor sajnos betelt — válassz másikat."
              : `${selectedSector.available_seats} szabad hely a ${selectedSector.total_seats} férőhelyből.`
            : "Kattints egy elérhető szektorra a stadion térképen vagy a listában."}
        </p>
      </header>

      {/* Quantity */}
      <section className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="ticket-qty"
            className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]"
          >
            Mennyiség
          </label>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Max {maxQty} jegy
          </span>
        </div>

        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-[var(--radius-md)]",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2",
          )}
        >
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={!selectedSector || quantity <= 1 || isSubmitting}
            aria-label="Eggyel kevesebb jegy"
            className={cn(
              "flex size-9 items-center justify-center rounded-full",
              "border border-[var(--glass-border)] text-[var(--text-primary)]",
              "transition-colors duration-200",
              "hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--glass-border)] disabled:hover:text-[var(--text-primary)]",
            )}
          >
            −
          </button>

          <input
            id="ticket-qty"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQty}
            value={quantity}
            disabled={!selectedSector || isSubmitting}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value || "1", 10);
              if (!Number.isFinite(next)) return;
              setQuantity(Math.min(Math.max(1, next), maxQty));
            }}
            className={cn(
              "w-20 bg-transparent text-center font-display text-2xl tabular-nums",
              "text-[var(--text-primary)] outline-none",
              "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none",
              "[&::-webkit-outer-spin-button]:appearance-none",
            )}
          />

          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={!selectedSector || quantity >= maxQty || isSubmitting}
            aria-label="Eggyel több jegy"
            className={cn(
              "flex size-9 items-center justify-center rounded-full",
              "border border-[var(--glass-border)] text-[var(--text-primary)]",
              "transition-colors duration-200",
              "hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--glass-border)] disabled:hover:text-[var(--text-primary)]",
            )}
          >
            +
          </button>
        </div>
      </section>

      {/* Coupon */}
      <section className="mt-5 space-y-2">
        <label
          htmlFor="ticket-coupon"
          className="block text-xs font-medium uppercase tracking-[0.2em] text-[var(--text-muted)]"
        >
          Kuponkód <span className="normal-case text-[var(--text-muted)]">(opcionális)</span>
        </label>
        <input
          id="ticket-coupon"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          placeholder="PL. CULER25"
          disabled={isSubmitting}
          className={cn(
            "w-full rounded-[var(--radius-md)] px-4 py-2.5",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            "text-sm tracking-[0.18em] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
            "outline-none transition-colors duration-200",
            "focus:border-[var(--accent-gold)] focus:bg-[var(--glass-bg-hover)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </section>

      {/* Price summary */}
      <section className="mt-6 space-y-2 rounded-[var(--radius-md)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4">
        <SummaryRow
          label="Jegy ár"
          value={
            selectedSector
              ? `${formatPrice(Number(selectedSector.price))} × ${quantity}`
              : "—"
          }
        />
        <div className="my-2 h-px bg-[var(--glass-border)]" />
        <SummaryRow
          label="Részösszeg"
          value={selectedSector ? formatPrice(subtotal) : "—"}
          accent
        />
        {couponCode && (
          <p className="pt-1 text-[10px] uppercase tracking-[0.2em] text-[var(--accent-gold)]">
            Kupon ellenőrzés a fizetés után
          </p>
        )}
      </section>

      {/* CTA */}
      <button
        type="button"
        onClick={() =>
          onPurchase({
            quantity,
            couponCode: couponCode.trim() || null,
          })
        }
        disabled={!canBuy}
        className={cn(
          "glass-button-primary mt-6 w-full",
          !canBuy && "cursor-not-allowed opacity-50 hover:translate-y-0",
        )}
      >
        {isSubmitting ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <TicketIcon size={14} aria-hidden />
        )}
        <span>
          {isSubmitting
            ? "Vásárlás folyamatban…"
            : selectedSector?.is_sold_out
              ? "Szektor betelt"
              : "Jegyvásárlás (demo)"}
        </span>
      </button>

      <p className="mt-3 text-center text-[10px] leading-relaxed text-[var(--text-muted)]">
        A „demo” felirat a szakdolgozat keretében használt fizetést jelzi —
        valódi pénzügyi tranzakció nem történik.
      </p>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          accent
            ? "font-display text-xl text-[var(--accent-gold)]"
            : "text-sm text-[var(--text-primary)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
