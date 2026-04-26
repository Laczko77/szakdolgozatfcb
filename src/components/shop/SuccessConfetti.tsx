"use client";

import { useMemo } from "react";

/**
 * Lightweight CSS-only confetti burst for the order success page.
 *
 * We deliberately avoid pulling in `canvas-confetti` — the burst plays
 * once on mount, so a few absolutely positioned coloured rectangles
 * driven by CSS animations are dramatically cheaper than spinning up a
 * canvas.  Particles are seeded deterministically from a fixed list of
 * inline styles so SSR/CSR markup matches.
 */
export function SuccessConfetti({ count = 28 }: { count?: number }) {
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Deterministic pseudo-random: avoids `Math.random()` mismatch
        // between server and client renders.
        const seed = (i + 1) * 9301 + 49297;
        const r1 = ((seed % 233280) / 233280);
        const r2 = (((seed * 7) % 233280) / 233280);
        const r3 = (((seed * 13) % 233280) / 233280);
        const colors = [
          "#a50044",
          "#004d98",
          "#d4a84b",
          "#f5c211",
          "#1a7f3c",
        ];
        return {
          left: `${r1 * 100}%`,
          background: colors[i % colors.length],
          duration: 1.6 + r2 * 1.6,
          delay: r3 * 0.4,
          rotate: Math.floor(r2 * 360),
          width: 6 + Math.floor(r3 * 6),
          height: 10 + Math.floor(r1 * 8),
        };
      }),
    [count],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{
            left: p.left,
            background: p.background,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
            width: `${p.width}px`,
            height: `${p.height}px`,
          }}
        />
      ))}

      <style jsx>{`
        .confetti-bit {
          position: absolute;
          top: -20px;
          border-radius: 1px;
          opacity: 0.95;
          animation-name: confetti-fall;
          animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94);
          animation-fill-mode: forwards;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0.6;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .confetti-bit {
            animation: none;
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
