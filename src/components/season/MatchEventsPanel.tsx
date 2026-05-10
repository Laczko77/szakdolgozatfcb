"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, AlertTriangle, Goal, Square } from "lucide-react";
import {
  fetchMatchDetails,
  type MatchDetailsResponse,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";
import { ErrorBlock } from "./primitives";

interface MatchEventsPanelProps {
  matchId: number;
  /** Used to colour-code home vs away events. */
  fcbId: number;
}

/**
 * Inline event timeline rendered when a row in MatchesTimeline expands.
 *
 * Lazy-fetches the backend's `/api/season/match/[id]` endpoint and
 * branches on `data_quality`:
 *   - 'full'        → goals + bookings + substitutions
 *   - 'partial'     → whatever the API returned, headed by an inline note
 *   - 'unavailable' → "Részletes események nem elérhetők" + only the score
 */
export function MatchEventsPanel({ matchId, fcbId }: MatchEventsPanelProps) {
  const [data, setData] = useState<MatchDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      setErrorMessage(null);
      setData(null);
    });
    const controller = new AbortController();
    fetchMatchDetails(matchId, controller.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "A meccs részletei jelenleg nem elérhetők",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [matchId, retryNonce]);

  if (loading) return <EventsSkeleton />;

  if (errorMessage) {
    return (
      <ErrorBlock
        message={errorMessage}
        onRetry={() => setRetryNonce((n) => n + 1)}
      />
    );
  }

  if (!data) return null;

  const { events, data_quality } = data;
  const totalEvents =
    events.goals.length +
    events.bookings.length +
    events.substitutions.length;

  if (data_quality === "unavailable" || totalEvents === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[var(--radius-md)]",
          "border border-dashed border-[var(--glass-border)]",
          "bg-[var(--glass-bg)] px-4 py-3 text-sm text-[var(--text-secondary)]",
        )}
      >
        <AlertTriangle
          size={16}
          aria-hidden
          className="shrink-0 text-[var(--accent-gold)]"
        />
        <span>
          Részletes események nem elérhetők ehhez a meccshez. Csak a
          végeredményt tudjuk megjeleníteni.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data_quality === "partial" && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
          Részleges adat — egy vagy több eseménytípus hiányzik.
        </p>
      )}

      {events.goals.length > 0 && (
        <EventGroup
          title="Gólok"
          icon={<Goal size={14} aria-hidden />}
          accent="text-[var(--accent-gold)]"
        >
          {events.goals.map((g, i) => (
            <EventRow
              key={`goal-${i}`}
              minute={g.minute}
              isFcb={g.team.id === fcbId}
              icon="goal"
            >
              <span className="font-medium text-[var(--text-primary)]">
                {g.scorer.name}
              </span>
              <span className="text-[var(--text-muted)]">{g.team.name}</span>
            </EventRow>
          ))}
        </EventGroup>
      )}

      {events.bookings.length > 0 && (
        <EventGroup
          title="Lapok"
          icon={<Square size={14} aria-hidden />}
          accent="text-amber-300"
        >
          {events.bookings.map((b, i) => (
            <EventRow
              key={`book-${i}`}
              minute={b.minute}
              isFcb={b.team.id === fcbId}
              icon={b.card === "RED" || b.card === "YELLOW_RED" ? "red" : "yellow"}
            >
              <span className="font-medium text-[var(--text-primary)]">
                {b.player.name}
              </span>
              <span className="text-[var(--text-muted)]">{b.team.name}</span>
            </EventRow>
          ))}
        </EventGroup>
      )}

      {events.substitutions.length > 0 && (
        <EventGroup
          title="Cserék"
          icon={<ArrowRightLeft size={14} aria-hidden />}
          accent="text-[var(--text-secondary)]"
        >
          {events.substitutions.map((s, i) => (
            <EventRow
              key={`sub-${i}`}
              minute={s.minute}
              isFcb={s.team.id === fcbId}
              icon="sub"
            >
              <span className="text-emerald-300">↑ {s.playerIn.name}</span>
              <span className="text-rose-300">↓ {s.playerOut.name}</span>
              <span className="text-[var(--text-muted)]">{s.team.name}</span>
            </EventRow>
          ))}
        </EventGroup>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EventGroup({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className={cn(
          "mb-2 inline-flex items-center gap-2",
          "font-display text-[11px] uppercase tracking-[0.25em]",
          accent,
        )}
      >
        {icon}
        {title}
      </p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function EventRow({
  minute,
  isFcb,
  icon,
  children,
}: {
  minute: number;
  isFcb: boolean;
  icon: "goal" | "yellow" | "red" | "sub";
  children: React.ReactNode;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: isFcb ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm",
        "border border-transparent",
        isFcb
          ? "bg-[var(--accent-gold)]/8 border-[var(--accent-gold)]/25"
          : "bg-[var(--glass-bg)]",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-9 shrink-0 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--bg-primary)]",
          "font-display text-[11px] tabular-nums text-[var(--text-secondary)]",
        )}
      >
        {minute}&apos;
      </span>
      <EventIcon kind={icon} />
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {children}
      </span>
    </motion.li>
  );
}

function EventIcon({ kind }: { kind: "goal" | "yellow" | "red" | "sub" }) {
  if (kind === "goal") {
    return (
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-gold)]/20 text-[var(--accent-gold)]"
      >
        ⚽
      </span>
    );
  }
  if (kind === "yellow") {
    return (
      <span
        aria-hidden
        className="block h-3.5 w-2.5 shrink-0 rounded-sm bg-amber-400"
      />
    );
  }
  if (kind === "red") {
    return (
      <span
        aria-hidden
        className="block h-3.5 w-2.5 shrink-0 rounded-sm bg-rose-500"
      />
    );
  }
  return (
    <ArrowRightLeft
      size={14}
      aria-hidden
      className="shrink-0 text-[var(--text-secondary)]"
    />
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-9 animate-pulse rounded-[var(--radius-md)] bg-[var(--glass-bg-hover)]"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}
