"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface AuthShellProps {
  /** H1 / display heading shown above the form. */
  title: string;
  /** Sub-line under the heading. Plain text or React node. */
  subtitle: React.ReactNode;
  /** The actual form. Sits inside the glass card body. */
  children: React.ReactNode;
  /** Footer link block (e.g. "Nincs fiókod? Regisztrálj"). */
  footer: React.ReactNode;
}

/**
 * Visual chrome shared by /login and /register.
 *
 * The composition:
 *   ┌───────────── viewport ─────────────────────┐
 *   │  noise grain overlay                       │
 *   │  faint orthogonal grid                     │
 *   │  blau orb (top-left) · grana orb (br)      │
 *   │           ┌──── glass card ────┐           │
 *   │           │ crest · title · …  │           │
 *   │           │ form (children)    │           │
 *   │           │ footer link        │           │
 *   │           └────────────────────┘           │
 *   └────────────────────────────────────────────┘
 *
 * All atmosphere is decorative (`aria-hidden`), and every motion respects
 * `prefers-reduced-motion`.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const reduce = useReducedMotion();

  return (
    <div className="relative isolate flex min-h-[calc(100vh-6rem)] items-center justify-center overflow-hidden px-4 py-12 md:py-16">
      {/* ── Atmospheric backdrop ─────────────────────────────────── */}
      <Backdrop reduced={reduce} />

      {/* ── Glass card ───────────────────────────────────────────── */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1] }}
        className={[
          "glass-card glass-border-gradient",
          "relative z-10 w-full max-w-md",
          "px-6 py-8 sm:px-10 sm:py-10",
        ].join(" ")}
        aria-labelledby="auth-heading"
      >
        {/* Inset gold hairline rim — emphasises the floating quality */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.08)",
          }}
        />

        {/* Brand — full-color logo, kerned wordmark */}
        <Link
          href="/"
          className="mb-7 flex items-center justify-center gap-3 focus-visible:outline-none"
          aria-label="Vissza a főoldalra"
        >
          <Image
            src="/images/logo/logo.png"
            alt="FC Barcelona"
            width={147}
            height={80}
            priority
            className="h-16 w-auto select-none drop-shadow-[0_0_18px_rgba(245,158,11,0.25)]"
          />
          <span className="font-display text-[var(--accent-blue)] text-xl tracking-[0.18em]">
            BARCAPULSE
          </span>
        </Link>

        {/* Heading + subtitle */}
        <div className="mb-7 text-center">
          <h1
            id="auth-heading"
            className="font-display text-[var(--text-primary)] mb-2 text-3xl uppercase tracking-[0.12em] sm:text-4xl"
          >
            {title}
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Form body */}
        <div className="space-y-5">{children}</div>

        {/* Footer link block */}
        <div className="text-text-secondary mt-8 text-center text-sm">
          {footer}
        </div>
      </motion.section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Backdrop — split out so the parent stays readable
// ─────────────────────────────────────────────────────────────────────

interface BackdropProps {
  reduced: boolean;
}

function Backdrop({ reduced }: BackdropProps) {
  return (
    <>
      {/* Radial mesh: gold core fading into deep blau */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 50% 35%, rgba(245,158,11,0.10), transparent 60%),
            radial-gradient(ellipse 80% 60% at 50% 100%, rgba(29,78,216,0.18), transparent 65%),
            radial-gradient(ellipse 50% 40% at 0% 100%, rgba(220,38,38,0.10), transparent 60%)
          `,
        }}
      />

      {/* Subtle orthogonal grid lattice */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] mix-blend-screen"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%)",
        }}
      />

      {/* Drifting orbs — blau (top-left) and grana (bottom-right) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 -z-10 h-[28rem] w-[28rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(29,78,216,0.45) 0%, rgba(29,78,216,0) 70%)",
          animation: reduced ? undefined : "drift 14s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -bottom-32 -z-10 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(220,38,38,0.35) 0%, rgba(220,38,38,0) 70%)",
          animation: reduced
            ? undefined
            : "drift 18s ease-in-out infinite reverse",
        }}
      />

      {/* Fine SVG noise — adds analog texture so the dark void doesn't read flat */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </>
  );
}
