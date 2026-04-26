/**
 * Localised formatters used across the public storefront.
 *
 * Prices are stored as DECIMAL(10,2) in HUF — we render them with the
 * Hungarian locale (no decimals, space as thousands separator) and a
 * trailing "Ft". Using `Intl.NumberFormat` keeps SSR/CSR output identical.
 */

const priceFormatter = new Intl.NumberFormat("hu-HU", {
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return "0 Ft";
  return `${priceFormatter.format(Math.round(value))} Ft`;
}

const dateFormatter = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFormatter.format(d);
}

const dateTimeFormatter = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}
