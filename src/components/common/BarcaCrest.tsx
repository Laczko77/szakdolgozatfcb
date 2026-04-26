import type { SVGProps } from "react";

/**
 * Stylised, symbolic FC Barcelona crest — geometric homage rather than
 * the official mark. Two upper quarters (blue + red), the iconic vertical
 * blaugrana stripes below, gold border, and the FCB monogram at center.
 *
 * Self-contained colors so it reads on any background.
 */
export function BarcaCrest({
  className,
  ...rest
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 120 140"
      role="img"
      aria-label="FC Barcelona pajzs"
      className={className}
      {...rest}
    >
      <defs>
        <linearGradient id="crestGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5C56A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#C4A34D" />
        </linearGradient>

        <linearGradient id="crestBlue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#003366" />
        </linearGradient>

        <linearGradient id="crestRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#8C0038" />
        </linearGradient>

        <clipPath id="crestShape">
          {/* Classic shield silhouette: flat top, gentle shoulders, pointed base */}
          <path d="M10 8 H110 V72 Q110 110 60 134 Q10 110 10 72 Z" />
        </clipPath>
      </defs>

      {/* Gold outer frame */}
      <path
        d="M10 8 H110 V72 Q110 110 60 134 Q10 110 10 72 Z"
        fill="url(#crestGold)"
      />

      {/* Inner clipped content */}
      <g clipPath="url(#crestShape)">
        {/* Cream parchment band behind upper quarters */}
        <rect x="6" y="4" width="108" height="64" fill="#F5EBD0" />

        {/* Top-left quarter: blue */}
        <rect x="6" y="4" width="54" height="44" fill="url(#crestBlue)" />
        {/* Top-right quarter: red */}
        <rect x="60" y="4" width="54" height="44" fill="url(#crestRed)" />

        {/* White cross dividing the quarters (St. George’s cross hint) */}
        <rect x="58" y="4" width="4" height="44" fill="#F9FAFB" />
        <rect x="6" y="46" width="108" height="3" fill="#F9FAFB" />

        {/* Lower blaugrana vertical stripes */}
        <rect x="6" y="49" width="108" height="22" fill="#F5EBD0" />
        {Array.from({ length: 5 }).map((_, i) => (
          <rect
            key={i}
            x={10 + i * 21}
            y={49}
            width={9}
            height={22}
            fill={i % 2 === 0 ? "url(#crestBlue)" : "url(#crestRed)"}
          />
        ))}

        {/* Bottom field — soft blaugrana wash */}
        <rect x="6" y="71" width="108" height="63" fill="#0a0e1a" />

        {/* FCB monogram at center, in gold */}
        <text
          x="60"
          y="108"
          textAnchor="middle"
          fontFamily="'Bebas Neue', system-ui, sans-serif"
          fontSize="34"
          fontWeight="700"
          fill="url(#crestGold)"
          letterSpacing="2"
        >
          FCB
        </text>

        {/* Tiny football accent */}
        <circle cx="60" cy="120" r="3.5" fill="#F9FAFB" />
        <circle cx="60" cy="120" r="3.5" fill="none" stroke="#0a0e1a" strokeWidth="0.6" />
      </g>

      {/* Inner gold inset ring for depth */}
      <path
        d="M10 8 H110 V72 Q110 110 60 134 Q10 110 10 72 Z"
        fill="none"
        stroke="url(#crestGold)"
        strokeWidth="2"
        opacity="0.7"
      />
    </svg>
  );
}
