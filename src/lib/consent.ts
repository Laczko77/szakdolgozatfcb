/**
 * GDPR cookie consent — local persistence layer.
 *
 * The frontend stores three pieces of state in localStorage:
 *
 *   fcb_consent_status : "accepted" | "declined"
 *   fcb_consent_cookie : a UUID minted by the server when the user accepts;
 *                        re-used as the `cookie_id` payload on every
 *                        /api/tracking/pageview request.
 *   fcb_consent_decided_at : ISO timestamp of the decision (debug-only)
 *
 * Reading from localStorage on every render would be wasteful, so the
 * {@link ConsentProvider} subscribes to a custom `fcb-consent-changed`
 * event that is dispatched from {@link setStoredConsent}. Other tabs are
 * picked up via the native `storage` event.
 *
 * IMPORTANT: localStorage is intentionally the single source of truth.
 * The backend has no concept of "remember this device", so re-reading the
 * decision client-side is the only way to honour it across reloads.
 */

export type ConsentStatus = "accepted" | "declined";

export interface ConsentRecord {
  status: ConsentStatus;
  cookieId: string | null;
  decidedAt: string;
}

export const CONSENT_STATUS_KEY = "fcb_consent_status";
export const CONSENT_COOKIE_KEY = "fcb_consent_cookie";
export const CONSENT_DECIDED_KEY = "fcb_consent_decided_at";
export const CONSENT_CHANGED_EVENT = "fcb-consent-changed";

/**
 * Read the stored consent record. Returns `null` when no decision has
 * been made yet (i.e. the banner should be shown).
 *
 * Safe to call during SSR — short-circuits to `null` when `window` is
 * unavailable.
 */
export function getStoredConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const status = window.localStorage.getItem(CONSENT_STATUS_KEY);
    if (status !== "accepted" && status !== "declined") return null;

    const cookieId = window.localStorage.getItem(CONSENT_COOKIE_KEY);
    const decidedAt =
      window.localStorage.getItem(CONSENT_DECIDED_KEY) ??
      new Date().toISOString();

    return {
      status,
      cookieId: status === "accepted" ? cookieId : null,
      decidedAt,
    };
  } catch {
    // Some browsers throw when localStorage is locked down (private
    // mode, third-party iframe, etc). Treat that as "no decision made".
    return null;
  }
}

/**
 * Persist a consent decision and broadcast the change.
 *
 * @param status   The user's decision.
 * @param cookieId Server-issued UUID. Required for "accepted", ignored
 *                 (and cleared) for "declined".
 */
export function setStoredConsent(
  status: ConsentStatus,
  cookieId: string | null,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CONSENT_STATUS_KEY, status);
    window.localStorage.setItem(CONSENT_DECIDED_KEY, new Date().toISOString());

    if (status === "accepted" && cookieId) {
      window.localStorage.setItem(CONSENT_COOKIE_KEY, cookieId);
    } else {
      window.localStorage.removeItem(CONSENT_COOKIE_KEY);
    }

    // Broadcast within the same tab — `storage` events do not fire for
    // the tab that performed the write, so without this the banner
    // wouldn't unmount until a reload.
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
  } catch {
    // Quota / private-mode failures are non-fatal — the decision just
    // won't persist across reloads. We deliberately do not surface a
    // toast here because the banner already provides UI feedback.
  }
}

/**
 * Clear the stored consent decision (e.g. for a "re-prompt me" debug
 * action). Currently unused in the UI but kept for future settings.
 */
export function clearStoredConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STATUS_KEY);
    window.localStorage.removeItem(CONSENT_COOKIE_KEY);
    window.localStorage.removeItem(CONSENT_DECIDED_KEY);
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT));
  } catch {
    // ignore
  }
}
