/**
 * Hungarian display labels for the raw `point_transactions.reason` enum
 * stored in the database.
 *
 * The DB stores machine identifiers ("poll_win", "coupon_redeem", …)
 * — these are deliberate, stable, and used by SQL triggers / RPCs.
 * The portal speaks Hungarian, so any UI surface that renders a
 * transaction must run the raw value through {@link formatPointReason}
 * before showing it.
 *
 * Keys come from:
 *   - `supabase/migrations/009_iter9_polls_and_points.sql` → `'poll_win'`
 *   - `supabase/migrations/010_iter10_coupons.sql`         → `'coupon_redeem'`
 *   - Any future reasons should be added here in lock-step with the
 *     SQL change so the user never sees a raw identifier again.
 *
 * Unknown reasons fall through to a Title-cased version of the raw key
 * with underscores normalised to spaces. This is a deliberate
 * fallback — it keeps the UI readable for new reasons that ship before
 * the translation map catches up, without surfacing the raw `snake_case`.
 */

const REASON_LABELS: Record<string, string> = {
  poll_win: "Sikeres tipp",
  poll_winner: "Sikeres tipp",
  coupon_redeem: "Kupon beváltás",
  registration_bonus: "Regisztrációs bónusz",
  purchase: "Vásárlás",
  admin_grant: "Admin jóváírás",
};

/**
 * Resolve a stored `reason` to a UI-ready label.
 *
 * - Exact match in the map → translated label
 * - Otherwise → Title-cased fallback ("custom_reward" → "Custom reward")
 * - Empty / missing input → empty string (caller decides how to render)
 */
export function formatPointReason(reason: string | null | undefined): string {
  if (!reason || typeof reason !== "string") return "";
  const key = reason.trim().toLowerCase();
  if (key.length === 0) return "";

  const mapped = REASON_LABELS[key];
  if (mapped) return mapped;

  // Fallback — turn `some_unknown_reason` into `Some unknown reason`.
  const spaced = key.replace(/_+/g, " ").trim();
  if (spaced.length === 0) return reason;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
