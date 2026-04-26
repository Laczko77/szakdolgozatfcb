"use client";

import Link from "next/link";

/**
 * Site footer.
 *
 * Mounted globally in src/app/layout.tsx so every route inherits it. On
 * mobile the bottom-tab bar overlaps the page bottom — the footer's
 * bottom padding (`pb-24 md:pb-10`) keeps content clear of it.
 *
 * NOTE on icons: lucide-react in this project no longer ships brand glyphs
 * (Twitter/Instagram/YouTube) — those were removed upstream. We render
 * inline SVG glyphs locally so the marks remain accurate.
 */

const LEGAL_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Impresszum", href: "#" },
  { label: "Adatvédelem", href: "#" },
  { label: "Kapcsolat", href: "#" },
];

interface SocialLink {
  label: string;
  href: string;
  glyph: React.ReactNode;
}

const xGlyph = (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    width="14"
    height="14"
    fill="currentColor"
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const igGlyph = (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

const ytGlyph = (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    width="16"
    height="16"
    fill="currentColor"
  >
    <path d="M21.582 7.186a2.51 2.51 0 0 0-1.768-1.778C18.254 5 12 5 12 5s-6.254 0-7.814.408a2.51 2.51 0 0 0-1.768 1.778C2 8.755 2 12 2 12s0 3.245.418 4.814a2.51 2.51 0 0 0 1.768 1.778C5.746 19 12 19 12 19s6.254 0 7.814-.408a2.51 2.51 0 0 0 1.768-1.778C22 15.245 22 12 22 12s0-3.245-.418-4.814zM10 15.02V8.98l5.2 3.02z" />
  </svg>
);

const SOCIALS: ReadonlyArray<SocialLink> = [
  { label: "X / Twitter", href: "#", glyph: xGlyph },
  { label: "Instagram", href: "#", glyph: igGlyph },
  { label: "YouTube", href: "#", glyph: ytGlyph },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="relative mt-12 w-full bg-[var(--bg-primary)] pb-24 pt-12 md:pb-10"
    >
      {/* Top hairline divider — subtle gradient that fades both ways */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--glass-border-hover) 50%, transparent 100%)",
        }}
      />

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-6 md:flex-row md:justify-between md:gap-4">
        {/* Brand */}
        <div className="flex flex-col items-center gap-1 md:items-start">
          <span className="font-display text-2xl tracking-wide text-[var(--accent-blue)]">
            BARCAPULSE
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            © {year} — A magyar culer-ek portálja.
          </span>
        </div>

        {/* Legal links */}
        <nav aria-label="Lábléc linkek">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-[var(--text-secondary)] transition-colors duration-200 hover:text-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Socials */}
        <ul className="flex items-center gap-2">
          {SOCIALS.map((social) => (
            <li key={social.label}>
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] transition-colors duration-200 hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]"
              >
                {social.glyph}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
