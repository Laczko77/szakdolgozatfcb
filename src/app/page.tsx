import HeroSection from "@/components/landing/HeroSection";
import AboutSection from "@/components/landing/AboutSection";
import PlayerCarousel from "@/components/landing/PlayerCarousel";
import BarcaText from "@/components/landing/BarcaText";
import CTASection from "@/components/landing/CTASection";
import { createClient } from "@/lib/supabase/server";
import { isPlayerPosition } from "@/lib/constants";
import { PLAYER_POSITION_LABELS } from "@/lib/player-positions";
import { readPlayerStats } from "@/lib/players-api";
import type { Player } from "@/types/database";

/**
 * Landing page — Frontend Iteration F3 (sections) + F7.5 (live carousel).
 *
 * Section flow (top → bottom):
 *   1. Hero          — Camp Nou video + headline + CTA
 *   2. About         — three-feature card grid + accent words
 *   3. PlayerCarousel — GSAP pinned scroll-scrub (desktop) / stack (mobile)
 *   4. BarcaText     — gradient FC BARCELONA divider
 *   5. CTASection    — "Légy része a [cycling word]" + register CTA
 *
 * F7.5 — the carousel was hardcoded in F3; now we fetch the top 3 players
 * by goals from the latest synced season and pass them as props. The
 * carousel keeps its hardcoded fallback so a fresh install (before the
 * admin sync runs) still has something to show.
 */

interface CarouselPlayer {
  name: string;
  number: number;
  position: string;
  goals: number;
  assists: number;
  appearances: number;
  image: string;
}

async function getTopPlayers(): Promise<ReadonlyArray<CarouselPlayer>> {
  const supabase = await createClient();

  // Resolve the most recent season we have rows for.
  const { data: latestRow } = await supabase
    .from("players")
    .select("season")
    .not("season", "is", null)
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();

  const season = (latestRow as Pick<Player, "season"> | null)?.season ?? null;

  let query = supabase
    .from("players")
    .select("*")
    .not("image_url", "is", null);
  if (season !== null) {
    query = query.eq("season", season);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Pick the 3 highest-goalscorers — the carousel reads best with
  // forward-leaning names. Defensive scoring fallbacks (assists, then
  // appearances) keep the order stable when goals tie.
  const ranked = (data as Player[])
    .map((p) => ({ player: p, stats: readPlayerStats(p.stats) }))
    .filter(({ player }) => Boolean(player.image_url) && player.number !== null)
    .sort((a, b) => {
      const dg = (b.stats.goals ?? 0) - (a.stats.goals ?? 0);
      if (dg !== 0) return dg;
      const da = (b.stats.assists ?? 0) - (a.stats.assists ?? 0);
      if (da !== 0) return da;
      return (b.stats.appearances ?? 0) - (a.stats.appearances ?? 0);
    })
    .slice(0, 3);

  return ranked.map(({ player, stats }) => ({
    name: player.name,
    number: player.number ?? 0,
    position:
      player.position && isPlayerPosition(player.position)
        ? PLAYER_POSITION_LABELS[player.position]
        : (player.position ?? ""),
    goals: stats.goals ?? 0,
    assists: stats.assists ?? 0,
    appearances: stats.appearances ?? 0,
    image: player.image_url ?? "",
  }));
}

export default async function HomePage() {
  const players = await getTopPlayers();

  return (
    <>
      <HeroSection />
      <AboutSection />
      <PlayerCarousel players={players} />
      <BarcaText />
      <CTASection />
    </>
  );
}
