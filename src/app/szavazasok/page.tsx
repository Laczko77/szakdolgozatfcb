"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Archive } from "lucide-react";
import type { EnrichedPoll } from "@/lib/polls-api";
import { fetchPolls } from "@/lib/polls-api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { PollCard } from "@/components/polls/PollCard";
import {
  PollCardSkeleton,
  PollsEmptyState,
} from "@/components/polls/PollsEmptyState";
import { cn } from "@/lib/utils";

/**
 * /szavazasok — public polls listing.
 *
 * Two stacked sections (active first, resolved second). Both share the
 * same {@link PollCard} so a poll's visual identity is consistent
 * regardless of where it surfaces.
 *
 * Data flow:
 *   - One round-trip to /api/polls?status=all on mount and on every
 *     refetch trigger (e.g. after a vote is cast).
 *   - The endpoint already enriches each poll with `results`,
 *     `total_votes`, and `user_vote`, so the page never needs a second
 *     fetch to render.
 *
 * Auth:
 *   - Page is intentionally public (read surface). The vote action
 *     gates on auth inside `PollCard`.
 *   - `user.id` is used as a refetch key so logging in/out flips the
 *     `user_vote` field correctly without a hard reload.
 */
export default function SzavazasokPage() {
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();

  const [polls, setPolls] = useState<EnrichedPoll[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await fetchPolls({ status: "all" }, signal);
        setPolls(data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        toast.error(
          err instanceof Error
            ? err.message
            : "Szavazások betöltése sikertelen",
        );
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (authLoading) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [authLoading, user?.id, load]);

  const { active, resolved } = useMemo(() => {
    const a: EnrichedPoll[] = [];
    const r: EnrichedPoll[] = [];
    for (const p of polls) {
      if (p.is_active) a.push(p);
      else r.push(p);
    }
    return { active: a, resolved: r };
  }, [polls]);

  // After a successful vote we refresh totals so other voters' counts
  // are reflected too. Cheap — it's a single endpoint.
  const refresh = useCallback(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-[1024px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      {/* Page header */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-8 sm:mb-12"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Szurkolói tippek
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-5xl sm:text-6xl lg:text-7xl",
          )}
        >
          Szavazz, és pontot szerzel.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
          Tippelj a következő mérkőzések eredményére, vagy mondd el, melyik
          játékos lesz a meccs hőse. Helyes találat esetén automatikusan{" "}
          <strong className="text-[var(--accent-gold)]">+50 pont</strong>{" "}
          jóváírásra kerül a Forca pontegyenlegedre.
        </p>
      </motion.header>

      {/* ACTIVE SECTION ----------------------------------------------- */}
      <SectionHeader
        eyebrow="Aktív szavazások"
        title="Most tippelhetsz"
        accent="emerald"
        count={active.length}
        loading={loading}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:gap-6">
          <PollCardSkeleton />
          <PollCardSkeleton />
        </div>
      ) : active.length === 0 ? (
        <PollsEmptyState variant="active" />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:gap-6">
          {active.map((poll, i) => (
            <PollCard
              key={poll.id}
              poll={poll}
              index={i}
              onVoteCast={refresh}
            />
          ))}
        </div>
      )}

      {/* RESOLVED SECTION --------------------------------------------- */}
      <div className="mt-14 sm:mt-20">
        <SectionHeader
          eyebrow="Lezárt szavazások"
          title="Eredmények"
          accent="muted"
          count={resolved.length}
          loading={loading}
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:gap-6">
            <PollCardSkeleton />
          </div>
        ) : resolved.length === 0 ? (
          <PollsEmptyState variant="resolved" />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:gap-6">
            {resolved.map((poll, i) => (
              <PollCard key={poll.id} poll={poll} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header helper
// ---------------------------------------------------------------------------

function SectionHeader({
  eyebrow,
  title,
  accent,
  count,
  loading,
}: {
  eyebrow: string;
  title: string;
  accent: "emerald" | "muted";
  count: number;
  loading: boolean;
}) {
  const Icon = accent === "emerald" ? Activity : Archive;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="mb-5 flex items-end justify-between gap-4 sm:mb-6"
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            accent === "emerald"
              ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              : "border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)]",
          )}
        >
          <Icon size={14} aria-hidden />
        </span>
        <div>
          <p
            className={cn(
              "font-display text-[10px] uppercase tracking-[0.32em]",
              accent === "emerald"
                ? "text-emerald-300"
                : "text-[var(--text-muted)]",
            )}
          >
            {eyebrow}
          </p>
          <h2 className="mt-0.5 font-display text-2xl tracking-wide text-[var(--text-primary)] sm:text-[1.6rem]">
            {title}
          </h2>
        </div>
      </div>
      {!loading && (
        <span className="font-display text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {count} elem
        </span>
      )}
    </motion.div>
  );
}
