"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cookie, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useConsent } from "@/providers/ConsentProvider";
import { cn } from "@/lib/utils";

/**
 * GDPR cookie consent banner — F14.1.
 *
 * Mounted globally in the layout. Visibility rules:
 *
 *   1. Hidden during SSR / before hydration so it never flashes on a
 *      returning visitor whose decision is already in localStorage.
 *   2. Hidden as soon as the visitor has a stored decision (accepted
 *      or declined) — driven reactively by `ConsentProvider`.
 *   3. Otherwise visible: pinned to the bottom edge of the viewport
 *      with a glass surface that floats above the rest of the UI.
 *
 * The banner intentionally does NOT block the page (no overlay, no
 * scroll lock). The user can keep browsing while the choice is
 * pending — declining is the legally safe default until they pick.
 */
export function CookieBanner() {
  const pathname = usePathname();
  const { hydrated, record, isSubmitting, accept, decline } = useConsent();

  // Admin routes are an authenticated, non-public surface — the GDPR
  // banner does not belong there.
  const onAdmin = pathname.startsWith("/admin");

  // Visible only when we know there is no prior decision.
  const visible = !onAdmin && hydrated && record === null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          // Slide up from below the viewport. Reduced-motion is handled
          // globally via `globals.css` (the @media block neutralises
          // transforms), so we don't branch here.
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
          // role="region" + aria-label is the recommended pattern for
          // a non-modal advisory banner. We do NOT use role="dialog"
          // because the banner is non-blocking.
          role="region"
          aria-label="Süti beállítások"
          className={cn(
            // Position: above the mobile bottom tab bar (h-16 + safe
            // area), and a comfortable margin on desktop.
            "fixed inset-x-0 z-50",
            "bottom-[calc(theme(spacing.16)+env(safe-area-inset-bottom))]",
            "md:bottom-6",
            "px-3 sm:px-4 md:px-6",
            "pointer-events-none",
          )}
        >
          <div
            className={cn(
              "pointer-events-auto mx-auto max-w-4xl",
              "glass-modal",
              "relative overflow-hidden",
              "p-4 sm:p-5",
            )}
          >
            {/* Decorative gold seam along the top edge — same trick as
                the dashboard widgets, ties the banner to the visual
                language of the rest of the surface. */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-6 top-0 h-px",
                "bg-gradient-to-r from-transparent via-[var(--accent-gold)]/60 to-transparent",
              )}
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              {/* Cookie icon — sits in a soft gold halo. */}
              <div
                aria-hidden
                className={cn(
                  "shrink-0",
                  "hidden h-11 w-11 items-center justify-center rounded-full sm:flex",
                  "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)]",
                  "text-[var(--accent-gold)]",
                )}
              >
                <Cookie size={20} strokeWidth={1.75} />
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-display text-xs uppercase tracking-[0.32em]",
                    "text-[var(--accent-gold)]",
                  )}
                >
                  Adatvédelem
                </p>
                <h2
                  className={cn(
                    "mt-1 font-display text-xl leading-tight tracking-wide",
                    "text-[var(--text-primary)] sm:text-2xl",
                  )}
                >
                  Tisztelünk — neked is van választásod
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Anonim oldalstatisztikát gyűjtenénk, hogy jobb élményt és
                  pontosabb termékajánlatokat tudjunk adni. Marketing- és
                  harmadik féltől származó sütik nincsenek.{" "}
                  <Link
                    href="/adatvedelem"
                    className="underline decoration-dotted underline-offset-4 hover:text-[var(--accent-gold)] transition-colors"
                  >
                    Részletes szabályzat
                  </Link>
                  .
                </p>
              </div>

              <div
                className={cn(
                  "flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center",
                  "sm:self-center",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    void decline();
                  }}
                  disabled={isSubmitting}
                  className={cn(
                    "glass-button-secondary",
                    "min-w-[140px] disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  Elutasítom
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void accept();
                  }}
                  disabled={isSubmitting}
                  className={cn(
                    "glass-button-primary",
                    "inline-flex min-w-[140px] items-center justify-center gap-2",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <ShieldCheck size={16} aria-hidden />
                  Elfogadom
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
