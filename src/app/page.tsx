import HeroSection from "@/components/landing/HeroSection";
import AboutSection from "@/components/landing/AboutSection";
import PlayerCarousel from "@/components/landing/PlayerCarousel";
import BarcaText from "@/components/landing/BarcaText";
import CTASection from "@/components/landing/CTASection";

/**
 * Landing page — Frontend Iteration F3.
 *
 * Section flow (top → bottom):
 *   1. Hero          — Camp Nou video + headline + CTA
 *   2. About         — three-feature card grid + accent words
 *   3. PlayerCarousel — GSAP pinned scroll-scrub (desktop) / stack (mobile)
 *   4. BarcaText     — gradient FC BARCELONA divider
 *   5. CTASection    — "Légy része a [cycling word]" + register CTA
 */
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <PlayerCarousel />
      <BarcaText />
      <CTASection />
    </>
  );
}
