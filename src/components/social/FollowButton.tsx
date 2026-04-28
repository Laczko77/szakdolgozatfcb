"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  ApiError,
  fetchFollowStatus,
  followUser,
  unfollowUser,
} from "@/lib/dm-api";
import type { FollowStatus, FollowStatusKind } from "@/types/dm";
import { cn } from "@/lib/utils";

/**
 * F26.4 — three-state follow button.
 *
 * Visual states (driven entirely by `status.status`):
 *   - `not_following` — gold-on-glass "Követés" CTA. Click sends a follow
 *     request via POST /api/users/[id]/follow → flips to `pending`.
 *   - `pending`       — disabled, muted, clock icon. The request has
 *     been sent but the target has not yet accepted.
 *   - `following`     — kept the legacy "Követed" affordance: glass
 *     surface, check icon, click confirms unfollow via DELETE.
 *
 * Animation: Framer Motion `layout` + AnimatePresence cross-fades the
 * label and icon between states so transitions feel purposeful rather
 * than as a hard re-render.
 *
 * The button hides itself for the caller's own profile and for guests.
 *
 * `iconOnly` collapses the label, used in tight surfaces (chat list
 * rows, chat header). The button still announces its label via
 * aria-label so screen readers stay informative.
 */
interface FollowButtonProps {
  targetUserId: string;
  /** Optional callback so parents can mirror the latest status. */
  onStatusChange?: (status: FollowStatus) => void;
  /**
   * If supplied, skips the status hydration round-trip — the parent
   * already has authoritative data (e.g. from the conversations list).
   */
  initialStatus?: FollowStatus | null;
  className?: string;
  size?: "xs" | "sm" | "md";
  /** Render only the icon — the label moves to aria-label. */
  iconOnly?: boolean;
}

export function FollowButton({
  targetUserId,
  onStatusChange,
  initialStatus,
  className,
  size = "md",
  iconOnly = false,
}: FollowButtonProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState<FollowStatus | null>(
    initialStatus ?? null,
  );
  const [hydrating, setHydrating] = useState(initialStatus == null);
  const [pending, setPending] = useState(false);

  // Hydrate follow status on mount / when target changes — unless the
  // parent already supplied an authoritative initial value. The setState
  // calls live inside an async IIFE so they never execute synchronously
  // inside the effect body itself (React 19's set-state-in-effect lint).
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      if (!user || user.id === targetUserId) {
        if (!c.signal.aborted) setHydrating(false);
        return;
      }
      if (initialStatus) {
        if (!c.signal.aborted) {
          setStatus(initialStatus);
          setHydrating(false);
        }
        return;
      }
      try {
        const data = await fetchFollowStatus(targetUserId, c.signal);
        if (c.signal.aborted) return;
        setStatus(data);
      } catch {
        // Status fetch is non-blocking; we just leave the button in
        // its placeholder state and let the next click force a request.
      } finally {
        if (!c.signal.aborted) setHydrating(false);
      }
    })();
    return () => c.abort();
  }, [user, targetUserId, initialStatus]);

  if (!user || (status?.isSelf ?? user.id === targetUserId)) {
    return null;
  }

  const kind: FollowStatusKind = status?.status ?? "not_following";

  const handleClick = async (e: React.MouseEvent) => {
    // The button often sits inside a clickable row — stop the event so
    // the parent doesn't navigate when the user toggles follow.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    if (kind === "pending") return; // disabled visual state

    setPending(true);

    try {
      if (kind === "following") {
        // Optimistic flip back to not_following.
        const next: FollowStatus = {
          status: "not_following",
          isFollowedBy: status?.isFollowedBy ?? false,
          isMutual: false,
        };
        setStatus(next);
        onStatusChange?.(next);

        try {
          await unfollowUser(targetUserId);
        } catch (err) {
          // Roll back.
          const prior: FollowStatus = {
            status: "following",
            isFollowedBy: status?.isFollowedBy ?? false,
            isMutual: status?.isFollowedBy ?? false,
          };
          setStatus(prior);
          onStatusChange?.(prior);
          throw err;
        }
      } else {
        // not_following → pending. The server enqueues a request that
        // the target needs to accept. We do NOT optimistically jump to
        // `following` because that's no longer instant.
        const next: FollowStatus = {
          status: "pending",
          isFollowedBy: status?.isFollowedBy ?? false,
          isMutual: false,
        };
        setStatus(next);
        onStatusChange?.(next);

        try {
          await followUser(targetUserId);
        } catch (err) {
          const prior: FollowStatus = {
            status: "not_following",
            isFollowedBy: status?.isFollowedBy ?? false,
            isMutual: false,
          };
          setStatus(prior);
          onStatusChange?.(prior);
          throw err;
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          toast.error("Felhasználó nem található");
          return;
        }
        if (err.status === 409) {
          // The server says we're already in this state — accept it.
          toast.info("A művelet már megtörtént");
          return;
        }
      }
      toast.error(
        err instanceof Error ? err.message : "Művelet sikertelen",
      );
    } finally {
      setPending(false);
    }
  };

  const sizing = iconOnly
    ? size === "xs"
      ? "h-7 w-7"
      : size === "sm"
        ? "h-8 w-8"
        : "h-9 w-9"
    : size === "xs"
      ? "px-2.5 py-1 text-[10px]"
      : size === "sm"
        ? "px-3.5 py-1.5 text-[11px]"
        : "px-5 py-2.5 text-xs";

  if (hydrating) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full border",
          "border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "animate-pulse text-transparent",
          sizing,
          className,
        )}
      >
        {iconOnly ? (
          <span className="h-3 w-3" />
        ) : (
          <>
            <span className="h-3 w-3" />
            <span>Követés</span>
          </>
        )}
      </span>
    );
  }

  // Map state → visual config.
  const config: {
    label: string;
    icon: React.ReactNode;
    classes: string;
    ariaPressed?: boolean;
  } =
    kind === "following"
      ? {
          label: "Követed",
          icon: <Check size={iconSizeFor(size)} aria-hidden />,
          ariaPressed: true,
          classes: cn(
            "border border-emerald-400/40 bg-emerald-400/[0.08]",
            "text-emerald-300 hover:text-[var(--accent-red)]",
            "hover:border-[var(--accent-red)]/40 hover:bg-[var(--accent-red)]/[0.06]",
          ),
        }
      : kind === "pending"
        ? {
            label: "Kérelem elküldve",
            icon: <Clock size={iconSizeFor(size)} aria-hidden />,
            ariaPressed: false,
            classes: cn(
              "border border-[var(--glass-border)] bg-[var(--glass-bg)]/60",
              "text-[var(--text-muted)]",
              "cursor-not-allowed",
            ),
          }
        : {
            label: "Követés",
            icon: <UserPlus size={iconSizeFor(size)} aria-hidden />,
            ariaPressed: false,
            classes: cn(
              "border border-[var(--accent-gold)]/50 bg-[var(--accent-gold)]/[0.08]",
              "text-[var(--accent-gold)]",
              "hover:bg-[var(--accent-gold)]/[0.14] hover:border-[var(--accent-gold)]",
            ),
          };

  return (
    <motion.button
      type="button"
      layout
      onClick={handleClick}
      disabled={pending || kind === "pending"}
      whileTap={kind === "pending" ? undefined : { scale: 0.94 }}
      aria-pressed={config.ariaPressed}
      aria-label={iconOnly ? config.label : undefined}
      title={iconOnly ? config.label : undefined}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full",
        "font-display uppercase tracking-[0.18em]",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
        "disabled:cursor-not-allowed",
        sizing,
        config.classes,
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={pending ? "pending-spin" : kind}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="inline-flex items-center gap-2"
        >
          {pending ? (
            <Loader2
              size={iconSizeFor(size)}
              className="animate-spin"
              aria-hidden
            />
          ) : (
            config.icon
          )}
          {!iconOnly && <span>{config.label}</span>}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function iconSizeFor(size: "xs" | "sm" | "md") {
  return size === "xs" ? 11 : size === "sm" ? 13 : 14;
}
