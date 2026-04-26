"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, MessageSquareQuote, Users2 } from "lucide-react";
import type { EnrichedPoll } from "@/lib/polls-api";
import { castVote } from "@/lib/polls-api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PollStatusBadge } from "./PollStatusBadge";
import { PollMatchBadge } from "./PollMatchBadge";
import { PollResultBar } from "./PollResultBar";
import { PointsEarnedBadge } from "./PointsEarnedBadge";

interface PollCardProps {
  poll: EnrichedPoll;
  /** Drives the whileInView staggered reveal. */
  index?: number;
  /** Compact variant used inside the dashboard widget — drops the meta row. */
  compact?: boolean;
  /** Called after a successful vote so the parent can refresh totals. */
  onVoteCast?: (pollId: string, selectedOption: number) => void;
  className?: string;
}

/**
 * The single source of truth for rendering one poll.
 *
 * State machine:
 *   - `active`  + `user_vote === null` → show option list with radio cards
 *   - `active`  + `user_vote !== null` → show "Leadva" confirmation, plus
 *     the running results so the user can see how the rest of the fanbase
 *     is breaking
 *   - `resolved`                       → show every option as a result bar,
 *     with the user's vote and the correct answer flagged. If the user
 *     picked correctly, the +50 pont celebratory badge fades in.
 *
 * Voting is gated on auth: an unauthenticated user clicking "Szavazok"
 * gets bounced to `/login` with a returnUrl back to /szavazasok.
 */
export function PollCard({
  poll,
  index = 0,
  compact = false,
  onVoteCast,
  className,
}: PollCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  // Local state mirrors the server values so optimistic updates render
  // instantly. The parent can still pass a fresh `poll` later — the
  // controlled-vs-uncontrolled drift here is acceptable because the
  // listing page refetches after every successful vote.
  const [userVote, setUserVote] = useState<number | null>(poll.user_vote);
  const [results, setResults] = useState<Record<number, number>>(poll.results);
  const [totalVotes, setTotalVotes] = useState<number>(poll.total_votes);
  const [pendingOption, setPendingOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isResolved = !poll.is_active;
  const hasVoted = userVote !== null;
  const isCorrectVoter =
    isResolved &&
    userVote !== null &&
    poll.correct_option !== null &&
    userVote === poll.correct_option;

  async function handleVote() {
    if (pendingOption === null || submitting) return;

    if (!user) {
      router.push("/login?returnUrl=/szavazasok");
      return;
    }

    setSubmitting(true);
    try {
      await castVote(poll.id, pendingOption);
      // Optimistic local update — the listing page will refetch the
      // canonical numbers shortly, but the user sees the bar fill
      // immediately.
      setUserVote(pendingOption);
      setResults((prev) => {
        const next = { ...prev };
        next[pendingOption] = (next[pendingOption] ?? 0) + 1;
        return next;
      });
      setTotalVotes((t) => t + 1);
      toast.success("Szavazat rögzítve! Köszönjük.");
      onVoteCast?.(poll.id, pendingOption);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Szavazat leadása sikertelen";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.55,
        delay: Math.min(index * 0.06, 0.36),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "glass-card glass-border-gradient",
        "relative flex flex-col gap-5 overflow-hidden p-5 sm:p-7",
        className,
      )}
    >
      {/* Soft top edge highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />

      {/* Header — meta row */}
      {!compact && (
        <header className="flex flex-wrap items-center gap-2">
          <PollStatusBadge isActive={poll.is_active} />
          {poll.match_id && <PollMatchBadge matchId={poll.match_id} />}
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1.5",
              "text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]",
            )}
          >
            <Users2 size={11} aria-hidden />
            <span className="tabular-nums">
              {totalVotes.toLocaleString("hu-HU")}
            </span>
            <span>szavazat</span>
          </span>
        </header>
      )}

      {/* Question */}
      <div className="flex items-start gap-3">
        <MessageSquareQuote
          size={compact ? 18 : 22}
          className="mt-1 shrink-0 text-[var(--accent-gold)]"
          aria-hidden
        />
        <h3
          className={cn(
            "font-display tracking-wide text-[var(--text-primary)]",
            compact
              ? "text-lg leading-snug sm:text-xl"
              : "text-xl leading-snug sm:text-2xl",
          )}
        >
          {poll.question}
        </h3>
      </div>

      {/* Body switches state */}
      <AnimatePresence mode="wait" initial={false}>
        {/* ---------- ACTIVE / NOT YET VOTED ---------- */}
        {!isResolved && !hasVoted && (
          <motion.div
            key="vote-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <ul role="radiogroup" aria-label={poll.question} className="space-y-2.5">
              {poll.options.map((option, idx) => {
                const checked = pendingOption === idx;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      disabled={submitting}
                      onClick={() => setPendingOption(idx)}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-[var(--radius-md)]",
                        "border px-4 py-3 text-left",
                        "transition-all duration-200",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
                        checked
                          ? "border-[var(--accent-gold)]/60 bg-[var(--accent-gold)]/[0.07] shadow-[0_0_0_1px_var(--accent-gold-subtle)_inset]"
                          : "border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
                        submitting && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          checked
                            ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/20"
                            : "border-[var(--glass-border-hover)]",
                        )}
                      >
                        {checked && (
                          <motion.span
                            layoutId={`poll-${poll.id}-radio-dot`}
                            className="h-2 w-2 rounded-full bg-[var(--accent-gold)]"
                          />
                        )}
                      </span>
                      <span
                        className={cn(
                          "text-sm sm:text-[0.95rem]",
                          checked
                            ? "text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]",
                        )}
                      >
                        {option.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-[var(--text-muted)]">
                Egy szavazás után már nem módosíthatod a választásod.
              </span>
              <button
                type="button"
                onClick={handleVote}
                disabled={pendingOption === null || submitting}
                className={cn(
                  "glass-button-primary px-5 py-2.5 text-xs",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  "disabled:hover:translate-y-0 disabled:hover:shadow-glass-md",
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                    <span>Küldés…</span>
                  </>
                ) : (
                  <>
                    <Check size={14} aria-hidden />
                    <span>Szavazok</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ---------- ACTIVE / ALREADY VOTED ---------- */}
        {!isResolved && hasVoted && (
          <motion.div
            key="voted-active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-3"
          >
            <VotedBanner />
            <ul className="space-y-2">
              {poll.options.map((option, idx) => (
                <li key={idx}>
                  <PollResultBar
                    label={option.label}
                    votes={results[idx] ?? 0}
                    totalVotes={totalVotes}
                    isUserVote={userVote === idx}
                    isCorrect={false}
                    index={idx}
                  />
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-[var(--text-muted)]">
              Az eredmény a szavazás lezárása után véglegesedik. Ha eltaláltad
              a helyes választ, automatikusan +50 pont jóváírásra kerül.
            </p>
          </motion.div>
        )}

        {/* ---------- RESOLVED ---------- */}
        {isResolved && (
          <motion.div
            key="resolved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="space-y-3"
          >
            {isCorrectVoter && (
              <div className="flex justify-center">
                <PointsEarnedBadge />
              </div>
            )}
            <ul className="space-y-2">
              {poll.options.map((option, idx) => (
                <li key={idx}>
                  <PollResultBar
                    label={option.label}
                    votes={results[idx] ?? 0}
                    totalVotes={totalVotes}
                    isUserVote={userVote === idx}
                    isCorrect={poll.correct_option === idx}
                    index={idx}
                  />
                </li>
              ))}
            </ul>
            {hasVoted && !isCorrectVoter && poll.correct_option !== null && (
              <p className="text-center text-xs text-[var(--text-muted)]">
                Sajnos nem találtad el. Tartson a szerencse a következő
                tippnél.
              </p>
            )}
            {!hasVoted && (
              <p className="text-center text-xs text-[var(--text-muted)]">
                Ezen a szavazáson nem vettél részt.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function VotedBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-2.5 rounded-[var(--radius-md)]",
        "border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/[0.08]",
        "px-3.5 py-2.5",
      )}
    >
      <motion.span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          "bg-[var(--accent-gold)] text-[#0a0e1a]",
        )}
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 18,
          delay: 0.05,
        }}
      >
        <Check size={14} strokeWidth={3} />
      </motion.span>
      <div className="min-w-0">
        <p className="font-display text-sm uppercase tracking-[0.16em] text-[var(--accent-gold)]">
          Szavazat leadva
        </p>
        <p className="text-[11px] text-[var(--text-secondary)]">
          A jelenlegi állás folyamatosan frissül.
        </p>
      </div>
    </motion.div>
  );
}
