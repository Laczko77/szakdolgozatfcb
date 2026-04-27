import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";

/**
 * Global 404 page.
 *
 * Hit when no route matches OR when a server component calls `notFound()`
 * (e.g. /hirek/[id] for a missing article, /jatekosok/[id] for a missing
 * player). Designed to feel like a quiet pause inside the dark canvas:
 * the same gradient halos as the landing hero, oversized "404" in
 * Bebas Neue with the Barça gradient, and two reassuring exits — Home and
 * Back — so the user never feels stranded.
 *
 * Server-rendered (no "use client") so it ships as static HTML and works
 * even if the client bundle fails to hydrate.
 */

export const metadata: Metadata = {
  title: "Az oldal nem található",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section
      aria-label="Az oldal nem található"
      className="relative isolate flex min-h-[80vh] items-center justify-center overflow-hidden px-6 py-20"
    >
      {/* Ambient halos — match the landing hero so the 404 feels like part
          of the portal, not a system error page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 30% 30%, rgba(29,78,216,0.10) 0%, rgba(0,0,0,0) 70%), radial-gradient(60% 50% at 70% 70%, rgba(220,38,38,0.10) 0%, rgba(0,0,0,0) 70%)",
          filter: "blur(20px)",
        }}
      />

      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center text-center">
        {/* Eyebrow */}
        <span
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-1 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-red)]" />
          Hiba
        </span>

        {/* The big number — uses the same gradient signature as the
            landing's <BarcaText>. */}
        <h1
          aria-label="404"
          className="font-display leading-none tracking-tight"
          style={{
            fontSize: "clamp(7rem, 22vw, 14rem)",
            backgroundImage:
              "linear-gradient(90deg, var(--accent-blue) 0%, var(--accent-gold) 50%, var(--accent-red) 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          404
        </h1>

        <h2 className="font-display mt-4 text-3xl tracking-wide text-[var(--text-primary)] sm:text-4xl md:text-5xl">
          Ez a pálya üres.
        </h2>

        <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
          A keresett oldal nem létezik, vagy átmenetileg nem érhető el.
          Térj vissza a főoldalra, vagy lépj egyet hátra.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="glass-button-primary group"
            aria-label="Vissza a főoldalra"
          >
            <Home size={16} strokeWidth={2.25} aria-hidden />
            <span>Főoldal</span>
          </Link>

          <Link
            href="/hirek"
            className="glass-button-secondary group"
            aria-label="Hírek megtekintése"
          >
            <ArrowLeft
              size={16}
              strokeWidth={2.25}
              aria-hidden
              className="transition-transform duration-300 group-hover:-translate-x-0.5"
            />
            <span>Böngészd a híreket</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
