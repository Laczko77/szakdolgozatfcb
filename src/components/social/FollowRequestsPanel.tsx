"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import {
  acceptFollowRequest,
  ApiError,
  fetchFollowRequests,
  rejectFollowRequest,
} from "@/lib/dm-api";
import { useToast } from "@/providers/ToastProvider";
import type { FollowRequest } from "@/types/dm";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

/**
 * F26.5 — Incoming follow-request manager surfaced on /kozosseg/uzenetek.
 *
 * Renders the pending requests as a stacked list of glass rows. Each
 * row offers an "Elfogad" / "Elutasít" pair — the action resolves
 * inline (no modal) because the surface is already a focused inbox-y
 * page; modals on inbox surfaces feel disproportionate.
 *
 * The component manages its own data lifecycle: fetch on mount, expose
 * a `refresh()` to the parent so a freshly-accepted request can also
 * trigger a conversation list reload. We also call `onCountChange`
 * after every list mutation so the parent can mirror the count into a
 * sidebar badge.
 *
 * Empty state: a single muted line, no big illustration. The page
 * already has a "Üzenetek" header that gives context; layering another
 * empty-state hero would feel like a placeholder explosion.
 */
interface FollowRequestsPanelProps {
  /**
   * Notified after the initial fetch and after every accept/reject so
   * the parent can render a count badge in the sidebar.
   */
  onCountChange?: (count: number) => void;
  /** Optional refetch trigger from the parent, e.g. after polling. */
  refreshSignal?: number;
}

export function FollowRequestsPanel({
  onCountChange,
  refreshSignal,
}: FollowRequestsPanelProps) {
  const toast = useToast();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reportCount = useCallback(
    (next: FollowRequest[]) => {
      onCountChange?.(next.length);
    },
    [onCountChange],
  );

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      try {
        setLoading(true);
        const data = await fetchFollowRequests(c.signal);
        if (c.signal.aborted) return;
        setRequests(data);
        reportCount(data);
      } catch (err) {
        if (c.signal.aborted) return;
        // 401 etc. — quietly empty rather than nag the user.
        if (!(err instanceof ApiError && err.status === 401)) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Követési kérelmek betöltése sikertelen",
          );
        }
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [reportCount, toast, refreshSignal]);

  const handleDecision = useCallback(
    async (request: FollowRequest, action: "accept" | "reject") => {
      if (busyId) return;
      setBusyId(request.id);
      try {
        if (action === "accept") {
          await acceptFollowRequest(request.id);
          toast.success(
            `Elfogadtad ${request.follower.username ?? "a szurkoló"} kérelmét`,
          );
        } else {
          await rejectFollowRequest(request.id);
          toast.info("Kérelem elutasítva");
        }
        setRequests((prev) => {
          const next = prev.filter((r) => r.id !== request.id);
          reportCount(next);
          return next;
        });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Művelet sikertelen",
        );
      } finally {
        setBusyId(null);
      }
    },
    [busyId, reportCount, toast],
  );

  if (loading) {
    return (
      <PanelShell>
        <ul className="space-y-2 px-2 pb-3 pt-2" aria-hidden>
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5"
            >
              <span className="h-9 w-9 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
              <span className="h-3 flex-1 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
              <span className="h-7 w-16 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
              <span className="h-7 w-16 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            </li>
          ))}
        </ul>
      </PanelShell>
    );
  }

  return (
    <PanelShell count={requests.length}>
      {requests.length === 0 ? (
        <p className="px-5 py-5 text-center text-xs text-[var(--text-secondary)]">
          Nincsenek beérkező kérelmek.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 px-2 pb-3 pt-1">
          <AnimatePresence initial={false}>
            {requests.map((req) => (
              <motion.li
                key={req.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16, scale: 0.97 }}
                transition={{ duration: 0.26, ease: "easeOut" }}
                className={cn(
                  "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5",
                  "border border-transparent transition-colors",
                  "hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
                )}
              >
                <Link
                  href={`/profil/${req.follower.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60"
                >
                  <Avatar
                    url={req.follower.avatar_url}
                    name={req.follower.username ?? "?"}
                    size={36}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--text-primary)]">
                      {req.follower.username ?? "Névtelen szurkoló"}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      <UserPlus size={10} aria-hidden />
                      <span>Követni szeretne</span>
                    </span>
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDecision(req, "accept")}
                    disabled={busyId === req.id}
                    aria-label={`Elfogadás — ${req.follower.username ?? "szurkoló"}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5",
                      "border border-emerald-400/40 bg-emerald-400/[0.08]",
                      "font-display text-[10px] uppercase tracking-[0.18em] text-emerald-300",
                      "transition-all duration-200",
                      "hover:bg-emerald-400/[0.18] hover:border-emerald-400/70",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    {busyId === req.id ? (
                      <Loader2 size={11} className="animate-spin" aria-hidden />
                    ) : (
                      <Check size={11} aria-hidden />
                    )}
                    <span>Elfogad</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDecision(req, "reject")}
                    disabled={busyId === req.id}
                    aria-label={`Elutasítás — ${req.follower.username ?? "szurkoló"}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1.5",
                      "border border-transparent",
                      "font-display text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]",
                      "transition-all duration-200",
                      "hover:border-[var(--accent-red)]/40 hover:bg-[var(--accent-red)]/[0.08]",
                      "hover:text-[var(--accent-red)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-red)]/60",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                    )}
                  >
                    <X size={11} aria-hidden />
                    <span>Elutasít</span>
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </PanelShell>
  );
}

function PanelShell({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      aria-label="Beérkező követési kérelmek"
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]/60 backdrop-blur-md",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <UserPlus
            size={12}
            className="text-[var(--accent-gold)]"
            aria-hidden
          />
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Követési kérelmek
          </p>
        </div>
        {typeof count === "number" && count > 0 && (
          <span
            className={cn(
              "rounded-full bg-[var(--accent-red)] px-2 py-0.5",
              "font-display text-[10px] tabular-nums tracking-wider text-white",
            )}
            aria-label={`${count} kérelem`}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </header>
      {children}
    </motion.section>
  );
}
