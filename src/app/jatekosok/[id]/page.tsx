import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPlayerPosition } from "@/lib/constants";
import {
  PLAYER_POSITION_LABELS,
  PLAYER_POSITION_SHORT,
} from "@/lib/player-positions";
import { readPlayerStats, hasStats } from "@/lib/players-api";
import type { Player } from "@/types/database";
import { PlayerStatRadar } from "@/components/players/PlayerStatRadar";
import { PlayerStatGrid } from "@/components/players/PlayerStatGrid";
import { cn } from "@/lib/utils";

/**
 * /jatekosok/[id] — public player profile page.
 *
 * Server-rendered (better SEO, OpenGraph metadata, no client-side flash
 * of skeletons). Fetches the row from Supabase directly — same pattern
 * as /hirek/[id].
 *
 * Layout:
 *   1. Vissza link
 *   2. Hero — fotó (bal) + név + szám + pozíció + pillanatkép-statok (jobb)
 *   3. Bio (admin által írt)
 *   4. Statisztikák — radar chart + 6 progress bar kártya
 */

type RouteParams = { id: string };

interface PageProps {
  params: Promise<RouteParams>;
}

async function getPlayer(id: string): Promise<Player | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as Player;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) {
    return { title: "Játékos nem található | FC Barcelona" };
  }
  return {
    title: `${player.name} | FC Barcelona`,
    description:
      player.bio ??
      `${player.name} statisztikái és profilja az FC Barcelona keretében.`,
  };
}

export default async function PlayerProfilePage({ params }: PageProps) {
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  const stats = readPlayerStats(player.stats);
  const statsAvailable = hasStats(stats);
  const positionLabel =
    player.position && isPlayerPosition(player.position)
      ? PLAYER_POSITION_LABELS[player.position]
      : player.position;
  const positionShort =
    player.position && isPlayerPosition(player.position)
      ? PLAYER_POSITION_SHORT[player.position]
      : "";

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Back link */}
      <Link
        href="/jatekosok"
        className={cn(
          "inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em]",
          "text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
          "rounded-full",
        )}
      >
        <ArrowLeft size={14} aria-hidden />
        Vissza a kerethez
      </Link>

      {/* Hero */}
      <section
        aria-labelledby="player-name"
        className={cn(
          "relative mt-6 overflow-hidden rounded-3xl",
          "glass-card-strong",
        )}
      >
        {/* Background tint — diagonal blaugrana wash */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(165,0,68,0.18), transparent 55%), radial-gradient(circle at 100% 100%, rgba(0,77,152,0.22), transparent 55%)",
          }}
        />

        <div className="relative grid grid-cols-1 gap-0 lg:grid-cols-[1fr_1.2fr]">
          {/* Photo */}
          <div className="relative aspect-[4/5] w-full overflow-hidden lg:aspect-auto lg:min-h-[520px]">
            {player.image_url ? (
              <Image
                src={player.image_url}
                alt={player.name}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 100vw"
                className="object-cover object-top"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--bg-secondary)]">
                <span className="font-display text-9xl tracking-widest text-[var(--accent-gold)] opacity-30">
                  FCB
                </span>
              </div>
            )}

            {/* Diagonal accent stripe */}
            <div
              aria-hidden
              className="pointer-events-none absolute -left-10 top-12 h-3 w-72 rotate-[-18deg]"
              style={{
                background:
                  "linear-gradient(90deg, var(--accent-red), var(--accent-blue))",
                boxShadow: "0 0 30px rgba(165,0,68,0.4)",
              }}
            />

            {/* Bottom fade so the gradient blends into the card body on mobile */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent lg:hidden"
            />

            {/* Mobile-only header info, sitting on the photo */}
            <div className="absolute inset-x-0 bottom-0 p-6 lg:hidden">
              <span
                className={cn(
                  "inline-flex rounded-full px-3 py-1.5",
                  "border border-[var(--glass-border-hover)] bg-black/40 backdrop-blur-md",
                  "text-[10px] font-medium uppercase tracking-[0.25em] text-white",
                )}
              >
                {positionLabel}
              </span>
              <h1
                id="player-name-mobile"
                className="mt-3 font-display text-4xl leading-none tracking-wide text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] sm:text-5xl"
              >
                {player.name}
              </h1>
              {player.number !== null && (
                <span
                  aria-hidden
                  className="mt-2 block font-display text-6xl leading-none"
                  style={{ color: "var(--accent-gold)" }}
                >
                  #{player.number}
                </span>
              )}
            </div>
          </div>

          {/* Info — desktop side panel */}
          <div className="hidden flex-col justify-between gap-8 p-10 lg:flex">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
                {positionShort && `#${positionShort} //`} {positionLabel}
              </p>
              <h1
                id="player-name"
                className="mt-4 font-display leading-[0.92] tracking-wide text-[var(--text-primary)] text-6xl xl:text-7xl"
              >
                {player.name}
              </h1>

              {player.number !== null && (
                <div className="mt-6 flex items-baseline gap-3">
                  <span className="text-xs uppercase tracking-[0.3em] text-[var(--text-secondary)]">
                    Mezszám
                  </span>
                  <span
                    className="font-display leading-none"
                    style={{
                      color: "var(--accent-gold)",
                      fontSize: "clamp(4rem, 7vw, 6.5rem)",
                      textShadow: "0 0 36px rgba(196,163,77,0.35)",
                    }}
                  >
                    {player.number}
                  </span>
                </div>
              )}
            </div>

            {/* Snapshot stats — three big numbers without progress bars */}
            <dl className="grid grid-cols-3 gap-4">
              <SnapshotStat label="Gól" value={stats.goals ?? 0} available={statsAvailable} />
              <SnapshotStat label="Gólpassz" value={stats.assists ?? 0} available={statsAvailable} />
              <SnapshotStat label="Meccs" value={stats.appearances ?? 0} available={statsAvailable} />
            </dl>
          </div>
        </div>
      </section>

      {/* Bio + Stats */}
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
        {/* Bio */}
        <section
          aria-labelledby="bio-heading"
          className="space-y-5"
        >
          <header>
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
              Bemutatkozás
            </p>
            <h2
              id="bio-heading"
              className="mt-2 font-display text-3xl tracking-wide text-[var(--text-primary)] sm:text-4xl"
            >
              A pályán és azon kívül
            </h2>
          </header>
          {player.bio ? (
            <p className="whitespace-pre-line text-base leading-relaxed text-[var(--text-secondary)]">
              {player.bio}
            </p>
          ) : (
            <p className="text-sm italic text-[var(--text-muted)]">
              Bemutatkozó szöveg hamarosan érkezik.
            </p>
          )}
        </section>

        {/* Stats */}
        <section
          aria-labelledby="stats-heading"
          className="space-y-6"
        >
          <header>
            <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
              Szezon teljesítmény
            </p>
            <h2
              id="stats-heading"
              className="mt-2 font-display text-3xl tracking-wide text-[var(--text-primary)] sm:text-4xl"
            >
              Statisztikák
            </h2>
          </header>

          <div
            className={cn(
              "rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)]",
              "p-4 backdrop-blur sm:p-6",
            )}
          >
            <PlayerStatRadar stats={stats} />
          </div>

          <PlayerStatGrid stats={stats} />
        </section>
      </div>
    </div>
  );
}

/* ---------- sub-components ---------- */

function SnapshotStat({
  label,
  value,
  available,
}: {
  label: string;
  value: number;
  available: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 backdrop-blur">
      <dt className="text-[10px] uppercase tracking-[0.25em] text-[var(--text-secondary)]">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-2 font-display text-4xl leading-none tabular-nums",
          available ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]",
        )}
      >
        {available ? value : "—"}
      </dd>
    </div>
  );
}
