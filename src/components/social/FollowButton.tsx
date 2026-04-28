"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  ApiError,
  fetchFollowStatus,
  followUser,
  unfollowUser,
} from "@/lib/dm-api";
import type { FollowStatus } from "@/types/dm";
import { cn } from "@/lib/utils";

/**
 * Toggle "Követés" / "Követed" button.
 *
 * Behaviour notes:
 *   - On mount we hydrate the current follow status from the server,
 *     unless the parent supplied a definitive `initialStatus` (e.g. the
 *     conversation list endpoint returns `is_following` inline, F25.4).
 *   - The toggle uses optimistic UI: we flip the local boolean before
 *     the request resolves, then roll back on failure.
 *   - F25.2 — error differentiation:
 *       · 404  → toast "Felhasználó nem található"
 *       · 409  → already following; we keep the optimistic "Követed"
 *               state instead of rolling back (server is authoritative,
 *               state agrees).
 *       · any  → generic toast with the server message.
 *   - The button hides itself for the caller's own profile and for guests.
 *   - `iconOnly` collapses the label, used in tight surfaces (chat list
 *     rows, chat header). The button still announces its label via
 *     aria-label so screen readers stay informative.
 *   - `onStatusChange` lets the parent mirror the latest status — used
 *     on /profil/[id] to gate the "Üzenet" CTA on mutual follow.
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
  // calls are wrapped in an async IIFE so they never execute
  // synchronously inside the effect body itself (React 19's
  // `react-hooks/set-state-in-effect` lint).
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

  const isFollowing = status?.isFollowing ?? false;

  const handleClick = async (e: React.MouseEvent) => {
    // The button often sits inside a clickable row/link — stop the
    // event so the parent doesn't navigate when the user toggles follow.
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);

    // Optimistic flip.
    const next: FollowStatus = {
      isFollowing: !isFollowing,
      isFollowedBy: status?.isFollowedBy ?? false,
      isMutual: !isFollowing && (status?.isFollowedBy ?? false),
    };
    setStatus(next);
    onStatusChange?.(next);

    try {
      if (isFollowing) {
        await unfollowUser(targetUserId);
      } else {
        await followUser(targetUserId);
      }
    } catch (err) {
      // F25.2 — surface meaningful errors instead of swallowing.
      if (err instanceof ApiError) {
        if (err.status === 404) {
          // Roll back; the user genuinely does not exist.
          const prior: FollowStatus = {
            isFollowing,
            isFollowedBy: status?.isFollowedBy ?? false,
            isMutual: isFollowing && (status?.isFollowedBy ?? false),
          };
          setStatus(prior);
          onStatusChange?.(prior);
          toast.error("Felhasználó nem található");
          return;
        }
        if (err.status === 409 && !isFollowing) {
          // Already following — server is authoritative, but our
          // optimistic state already shows "Követed". Keep it.
          toast.info("Már követed ezt a felhasználót");
          return;
        }
      }

      // Generic rollback.
      const prior: FollowStatus = {
        isFollowing,
        isFollowedBy: status?.isFollowedBy ?? false,
        isMutual: isFollowing && (status?.isFollowedBy ?? false),
      };
      setStatus(prior);
      onStatusChange?.(prior);
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
        {iconOnly ? <span className="h-3 w-3" /> : (
          <>
            <span className="h-3 w-3" />
            <span>Követés</span>
          </>
        )}
      </span>
    );
  }

  const label = isFollowing ? "Követed" : "Követés";
  const iconSize = size === "xs" ? 11 : size === "sm" ? 13 : 14;

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={pending}
      whileTap={{ scale: 0.94 }}
      aria-pressed={isFollowing}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full",
        "font-display uppercase tracking-[0.18em]",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
        "disabled:cursor-not-allowed disabled:opacity-60",
        sizing,
        isFollowing
          ? cn(
              "border border-[var(--glass-border-hover)] bg-[var(--glass-bg)]",
              "text-[var(--text-secondary)] hover:text-[var(--accent-red)]",
              "hover:border-[var(--accent-red)]/40",
            )
          : cn(
              "border border-[var(--accent-gold)]/50 bg-[var(--accent-gold)]/[0.08]",
              "text-[var(--accent-gold)]",
              "hover:bg-[var(--accent-gold)]/[0.14] hover:border-[var(--accent-gold)]",
            ),
        className,
      )}
    >
      {pending ? (
        <Loader2 size={iconSize} className="animate-spin" aria-hidden />
      ) : isFollowing ? (
        <Check size={iconSize} aria-hidden />
      ) : (
        <UserPlus size={iconSize} aria-hidden />
      )}
      {!iconOnly && <span>{label}</span>}
    </motion.button>
  );
}
