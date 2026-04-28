"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Check, HelpCircle, Loader2, Vote } from "lucide-react";
import type { EnrichedPoll } from "@/lib/polls-api";
import { castVote } from "@/lib/polls-api";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/utils";
import { WidgetShell } from "./WidgetShell";

interface ActivePollWidgetProps {
  poll: EnrichedPoll | null;
  /** Drives the staggered grid reveal. */
  index?: number;
  /** Called after a successful vote so the parent can refresh. */
  onVoteCast?: () => void;
  className?: string;
}

/**
 * Dashboard widget that surfaces the *single* freshest active poll and
 * lets the user vote without leaving /dashboard.
 *
 * Why a custom widget instead of dropping in <PollCard compact>?
 *  - The shell here matches the visual rhythm of the rest of the
 *    dashboard widgets ({@link WidgetShell} eyebrow + CTA pattern).
 *  - The body is intentionally minimal: pick → submit, that's it. The
 *    full results experience lives at /szavazasok.
 *
 * If the user has already voted, we collapse into a confirmation tile
 * with a deep-link to the full poll page so they can see the running
 * tally.
 */
export function ActivePollWidget({
  poll,
  index = 0,
  onVoteCast,
  className,
}: ActivePollWidgetProps) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [pendingOption, setPendingOption] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [justVoted, setJustVoted] = useState<number | null>(null);

  const hasVoted = poll?.user_vote !== null && poll?.user_vote !== undefined;
  const lockedSelection = hasVoted ? poll!.user_vote : justVoted;

  async function handleVote() {
    if (!poll || pendingOption === null || submitting) return;

    if (!user) {
      router.push("/login?returnUrl=/dashboard");
      return;
    }

    setSubmitting(true);
    try {
      await castVote(poll.id, pendingOption);
      setJustVoted(pendingOption);
      toast.success("Szavazat rögzítve! Köszönjük.");
      onVoteCast?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Szavazat leadása sikertelen",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WidgetShell
      eyebrow="Aktív szavazás"
      title={poll?.question ?? "Nincs aktív szavazás"}
      cta={
        poll
          ? { label: "Összes szavazás", href: "/szavazasok" }
          : undefined
      }
      index={index}
      className={className}
    >
      {!poll ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="wait" initial={false}>
            {lockedSelection !== null && lockedSelection !== undefined ? (
              <motion.div
                key="voted"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-3"
              >
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-md)]",
                    "border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/[0.07]",
                    "px-3.5 py-3",
                  )}
                >
                  <motion.span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      "bg-[var(--accent-gold)] text-[#0a0e1a]",
                    )}
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 18,
                    }}
                  >
                    <Check size={16} strokeWidth={3} />
                  </motion.span>
                  <div className="min-w-0">
                    <p className="font-display text-sm uppercase tracking-[0.16em] text-[var(--accent-gold)]">
                      Leadva
                    </p>
                    <p className="truncate text-sm text-[var(--text-secondary)]">
                      {poll.options[lockedSelection]?.label ?? "—"}
                    </p>
                  </div>
                </div>
                <Link
                  href="/szavazasok"
                  className={cn(
                    "group inline-flex items-center gap-1.5 text-sm",
                    "text-[var(--text-secondary)] transition-colors",
                    "hover:text-[var(--accent-gold)]",
                  )}
                >
                  Eredmények és állás
                  <ArrowUpRight
                    size={14}
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <ul
                  role="radiogroup"
                  aria-label={poll.question}
                  className="space-y-2"
                >
                  {poll.options.map((option, idx) => {
                    const checked = pendingOption === idx;
                    const isNone = option.is_none === true;
                    return (
                      <li key={idx}>
                        {isNone && (
                          <div
                            aria-hidden
                            className="my-1.5 h-px bg-gradient-to-r from-transparent via-[var(--glass-border-hover)] to-transparent"
                          />
                        )}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          disabled={submitting}
                          onClick={() => setPendingOption(idx)}
                          title={isNone ? "Ha a te tipped nem szerepel a listában" : undefined}
                          className={cn(
                            "group flex w-full items-center gap-2.5 rounded-[var(--radius-md)]",
                            "border px-3 py-2.5 text-left text-sm",
                            "transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
                            checked
                              ? "border-[var(--accent-gold)]/60 bg-[var(--accent-gold)]/[0.07]"
                              : isNone
                                ? "border-dashed border-[var(--glass-border-hover)]/70 bg-[var(--glass-bg)]/40 hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]/60"
                                : "border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                              checked
                                ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/20"
                                : "border-[var(--glass-border-hover)]",
                            )}
                          >
                            {checked && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-gold)]" />
                            )}
                          </span>
                          {isNone && !checked && (
                            <HelpCircle
                              size={12}
                              className="shrink-0 text-[var(--text-muted)]"
                              aria-hidden
                            />
                          )}
                          <span
                            className={cn(
                              "truncate",
                              isNone && !checked && "italic",
                              checked
                                ? "text-[var(--text-primary)]"
                                : isNone
                                  ? "text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]"
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
                <button
                  type="button"
                  onClick={handleVote}
                  disabled={pendingOption === null || submitting}
                  className={cn(
                    "glass-button-primary w-full px-5 py-2.5 text-xs",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                      <span>Küldés…</span>
                    </>
                  ) : (
                    <>
                      <Vote size={14} aria-hidden />
                      <span>Szavazok</span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </WidgetShell>
  );
}

function EmptyState() {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-6 text-center",
        "rounded-[var(--radius-md)] border border-dashed border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]",
      )}
    >
      <Vote size={26} className="text-[var(--text-muted)]" aria-hidden />
      <p className="text-sm text-[var(--text-secondary)]">
        Jelenleg nincs aktív szavazás. Új tipp minden meccshét előtt.
      </p>
      <Link
        href="/szavazasok"
        className="text-xs uppercase tracking-[0.2em] text-[var(--accent-gold)] hover:underline"
      >
        Korábbi eredmények
      </Link>
    </div>
  );
}
