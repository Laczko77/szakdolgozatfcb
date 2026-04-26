---
name: Landing page animation conventions
description: Animation library division-of-labor and shared CSS keyframes registered for landing components
type: project
---

The landing page (F3) established the animation library conventions for
the rest of the project:

- **CSS-only**: hover/transition states, the `pulse-gold` CTA shimmer,
  `bounce-soft` scroll indicator, `gold-glow-in` accent words, `drift`
  noise overlay, and the `barca-text` gradient sweep. All keyframes live
  in `src/app/globals.css` AFTER the `@layer components` block (they
  cannot be inside `@layer` because keyframes are global).
- **Framer Motion**: viewport-triggered fades / staggered reveals
  (`whileInView` with `viewport={{ once: true }}`), and AnimatePresence
  for cross-fades (player carousel slide swap, CTA word cycler).
- **GSAP + ScrollTrigger**: pin/scrub for the player carousel (desktop
  only). Mobile/touch path is a plain vertical stack — gated via a hidden
  `md:block` / `md:hidden` split, not via JS feature detection in render.

**Why:** Mixed responsibilities make it hard to audit performance.
Putting one tool per concern means a glance at imports tells you what
kind of motion you're getting.

**How to apply:** When a future iteration adds animations, place them in
the order CSS → Framer → GSAP and only escalate when the previous tier
can't express the effect. Reuse the keyframes already in globals.css
(pulse-gold, bounce-soft, gold-glow-in, drift) rather than redefining.
