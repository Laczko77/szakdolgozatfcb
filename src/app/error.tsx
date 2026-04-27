"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Global runtime error boundary.
 *
 * Triggered when any server or client component throws past its own
 * try/catch. We log to the console so devs and crash reporters
 * (Sentry, etc., when wired) can observe the actual error, but the
 * UI stays calm: a glass card with an apology, a Retry button (which
 * fires Next.js's `reset()` to re-render the segment), and a Home
 * link as an absolute fallback.
 *
 * Note: this file MUST be a Client Component — that's a Next.js
 * App Router constraint for `error.tsx`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <section
      aria-label="Váratlan hiba"
      role="alert"
      className="relative isolate flex min-h-[80vh] items-center justify-center overflow-hidden px-6 py-20"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(220,38,38,0.10) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(20px)",
        }}
      />

      <div className="glass-card-strong relative mx-auto flex w-full max-w-xl flex-col items-center gap-5 p-8 text-center md:p-12">
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--accent-red)] bg-[var(--glass-bg)]"
          style={{ color: "var(--accent-red)" }}
          aria-hidden
        >
          <AlertTriangle size={26} strokeWidth={1.75} />
        </span>

        <h1 className="font-display text-3xl tracking-wide text-[var(--text-primary)] sm:text-4xl">
          Valami félrement.
        </h1>

        <p className="max-w-md text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
          Hiba történt az oldal betöltése közben. Próbáld újra — ha
          továbbra is fennáll, lépj vissza a főoldalra.
        </p>

        {error.digest && (
          <code
            className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1 font-mono text-[11px] tracking-wider text-[var(--text-muted)]"
            aria-label="Hiba azonosítója"
          >
            {error.digest}
          </code>
        )}

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="glass-button-primary group"
            aria-label="Újrapróbálás"
          >
            <RotateCcw
              size={16}
              strokeWidth={2.25}
              aria-hidden
              className="transition-transform duration-500 group-hover:-rotate-180"
            />
            <span>Újrapróbálás</span>
          </button>

          <Link
            href="/"
            className="glass-button-secondary"
            aria-label="Vissza a főoldalra"
          >
            <Home size={16} strokeWidth={2.25} aria-hidden />
            <span>Főoldal</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
