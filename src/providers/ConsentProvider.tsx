"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CONSENT_CHANGED_EVENT,
  CONSENT_COOKIE_KEY,
  CONSENT_STATUS_KEY,
  getStoredConsent,
  setStoredConsent,
  type ConsentRecord,
  type ConsentStatus,
} from "@/lib/consent";
import { postConsent } from "@/lib/analytics-api";

/**
 * Reactive consent state, shared between the cookie banner and the
 * page-tracking hook.
 *
 * `record === null && hydrated === true` is the "first visit, banner
 * should appear" state. While `hydrated === false` we render nothing
 * cookie-related so the banner never flashes during SSR hydration on a
 * returning visitor whose decision is already in localStorage.
 *
 * The provider also handles the actual server round-trip so callers
 * (the banner) only need to know `accept()` / `decline()`.
 */

interface ConsentContextValue {
  /** True once we've read localStorage on the client. */
  hydrated: boolean;
  /** The stored decision, or null when no decision has been made. */
  record: ConsentRecord | null;
  /** True when an accept/decline call is in-flight. */
  isSubmitting: boolean;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ref-mirror of the latest cookieId so `submit` can stay stable
  // across re-renders without lying to the React Compiler about its
  // dependency set. Updated in an effect (not during render) to satisfy
  // the react-hooks/refs rule.
  const cookieIdRef = useRef<string | null>(null);
  useEffect(() => {
    cookieIdRef.current = record?.cookieId ?? null;
  }, [record?.cookieId]);

  // Initial hydration from localStorage and subscription to changes.
  useEffect(() => {
    const sync = () => setRecord(getStoredConsent());

    // The lint rule (react-hooks/set-state-in-effect) blocks synchronous
    // setStates from inside an effect body. Queueing both updates via a
    // microtask defers them past the effect body without changing the
    // observable behaviour (still resolves before paint).
    queueMicrotask(() => {
      sync();
      setHydrated(true);
    });

    // Same-tab updates fire a CustomEvent; cross-tab updates fire the
    // native `storage` event. We listen to both so a decision made in
    // one tab unmounts the banner everywhere.
    const onCustom = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === null || // localStorage.clear()
        e.key === CONSENT_STATUS_KEY ||
        e.key === CONSENT_COOKIE_KEY
      ) {
        sync();
      }
    };

    window.addEventListener(CONSENT_CHANGED_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const submit = useCallback(async (status: ConsentStatus) => {
    setIsSubmitting(true);
    try {
      // Reuse any existing cookie_id so revoking + re-accepting in the
      // same browser keeps the same identifier (the backend upserts).
      // Read via ref so this callback doesn't get re-memoized on every
      // record change — keeps the React Compiler happy.
      const existingCookie = cookieIdRef.current ?? undefined;
      const result = await postConsent(
        status === "accepted",
        existingCookie,
      );
      setStoredConsent(
        status,
        status === "accepted" ? result.cookie_id : null,
      );
      // The custom event handler above will update `record` on the
      // next tick — no manual setRecord here keeps the source-of-
      // truth single.
    } catch (err) {
      // Even if the backend round-trip fails we still respect the
      // user's decision locally. Tracking will simply stay disabled
      // because the server gate (`consented = true`) won't have a
      // matching row to honour. We use `setStoredConsent` with an
      // empty cookie so a subsequent navigation tries again later.
      setStoredConsent(status, null);
      console.warn("[consent] backend sync failed", err);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const accept = useCallback(() => submit("accepted"), [submit]);
  const decline = useCallback(() => submit("declined"), [submit]);

  const value = useMemo<ConsentContextValue>(
    () => ({ hydrated, record, isSubmitting, accept, decline }),
    [hydrated, record, isSubmitting, accept, decline],
  );

  return (
    <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used inside <ConsentProvider />");
  }
  return ctx;
}
