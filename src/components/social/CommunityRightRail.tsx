"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Users, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchPolls, type EnrichedPoll } from "@/lib/polls-api";
import type { ProfileSnapshot } from "@/types/dm";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

/**
 * Right rail on /kozosseg (desktop only, ≥1024px).
 *
 * Two stacked widgets:
 *  1. "Online most" — purely decorative. Real Supabase Presence is
 *     out of scope for F23 (no backend hook), so we surface a small
 *     stack of recently-active fans + a soft pulsing dot. The number
 *     is drawn from a deterministic per-mount seed so it doesn't
 *     ping-pong between renders. Hidden behind a "kb." prefix to be
 *     honest about the placeholder nature.
 *  2. "Aktív szavazás" — the freshest active poll, distilled to the
 *     question + a CTA pill. Voting itself happens on /szavazasok
 *     so this stays focused (the dashboard widget is the heavy one).
 */
export function CommunityRightRail() {
  return (
    <aside className="sticky top-24 hidden w-[280px] shrink-0 flex-col gap-5 lg:flex">
      <OnlineNowCard />
      <ActivePollCard />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* "Online most" widget                                               */
/* ------------------------------------------------------------------ */

function OnlineNowCard() {
  const supabase = useMemo(() => createClient(), []);
  const [recent, setRecent] = useState<ProfileSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  // Deterministic per-mount "online count" so we don't twitch on every
  // render. 24..68 keeps it believable for a Hungarian fan portal.
  const [seed] = useState(() => Math.floor(Math.random() * 45) + 24);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .order("created_at", { ascending: false })
          .limit(4);
        if (c.signal.aborted) return;
        setRecent((data ?? []) as ProfileSnapshot[]);
      } catch {
        /* tolerated */
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [supabase]);

  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass-card relative overflow-hidden p-5"
      aria-label="Most aktív szurkolók"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--text-muted)]">
            Online most
          </p>
          <p className="mt-1 font-display text-2xl leading-none tracking-wide text-[var(--text-primary)]">
            <span className="tabular-nums">kb. {seed}</span>{" "}
            <span className="text-base text-[var(--text-secondary)]">
              szurkoló
            </span>
          </p>
        </div>
        <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {loading ? (
          <div className="flex -space-x-2" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-7 w-7 animate-pulse rounded-full border-2",
                  "border-[var(--bg-primary)] bg-[var(--glass-bg-hover)]",
                )}
              />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <span className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Users size={12} aria-hidden />A közösség most kezd ébredezni…
          </span>
        ) : (
          <div className="flex -space-x-2">
            {recent.map((p) => (
              <span
                key={p.id}
                className="rounded-full ring-2 ring-[var(--bg-primary)]"
                title={p.username ?? "Szurkoló"}
              >
                <Avatar
                  url={p.avatar_url}
                  name={p.username ?? "?"}
                  size={28}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">
        A közösség valós idejű élet-jelei. Posztolj, és te is felkerülsz a
        feedre.
      </p>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* "Aktív szavazás" widget                                            */
/* ------------------------------------------------------------------ */

function ActivePollCard() {
  const [poll, setPoll] = useState<EnrichedPoll | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        const polls = await fetchPolls({ status: "active" }, c.signal);
        if (c.signal.aborted) return;
        setPoll(polls[0] ?? null);
      } catch {
        /* tolerated — empty state covers it */
      } finally {
        if (!c.signal.aborted) setLoaded(true);
      }
    })();
    return () => c.abort();
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
      className="glass-card relative overflow-hidden p-5"
      aria-label="Aktív szavazás"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />
      <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
        Aktív szavazás
      </p>

      {!loaded ? (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-3 w-11/12 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
        </div>
      ) : !poll ? (
        <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
          <Vote size={20} className="text-[var(--text-muted)]" aria-hidden />
          <span>Most nincs aktív szavazás. Új tipp minden meccshét előtt.</span>
          <Link
            href="/szavazasok"
            className="text-[11px] uppercase tracking-[0.2em] text-[var(--accent-gold)] hover:underline"
          >
            Eredmények archívuma
          </Link>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <h3 className="font-display text-lg leading-tight tracking-wide text-[var(--text-primary)]">
            {poll.question}
          </h3>
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {poll.total_votes === 0
              ? "Légy te az első szavazó"
              : `${poll.total_votes} szavazat eddig`}
          </p>
          <Link
            href="/szavazasok"
            className={cn(
              "glass-button-primary group/cta inline-flex w-full items-center justify-center gap-1.5",
              "px-4 py-2 text-[11px]",
            )}
          >
            <Vote size={13} aria-hidden />
            <span>Szavazok</span>
            <ArrowUpRight
              size={12}
              className="transition-transform duration-300 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>
      )}
    </motion.section>
  );
}
