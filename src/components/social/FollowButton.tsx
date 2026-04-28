"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, UserPlus } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import {
  fetchFollowStatus,
  followUser,
  unfollowUser,
} from "@/lib/dm-api";
import type { FollowStatus } from "@/types/dm";
import { cn } from "@/lib/utils";

/**
 * Toggle "Követés" / "Követed" button used on other-user profile pages.
 *
 * Behaviour notes:
 *   - On mount we hydrate the current follow status from the server.
 *     Until that response lands the button stays in a neutral skeleton
 *     state — never starts as "Követed" then snaps to "Követés".
 *   - The toggle itself uses optimistic UI: we flip the local boolean
 *     before the request resolves, then roll back on failure.
 *   - The button hides itself for the caller's own profile (isSelf) and
 *     for guests (`useAuth().user === null`) — guests get a sign-in CTA.
 *   - `onStatusChange` lets the parent (e.g. the profile page) react
 *     to mutual-follow transitions, e.g. revealing the "Üzenet" button.
 */
interface FollowButtonProps {
  targetUserId: string;
  /** Optional callback so parents can mirror the latest status. */
  onStatusChange?: (status: FollowStatus) => void;
  className?: string;
  size?: "sm" | "md";
}

export function FollowButton({
  targetUserId,
  onStatusChange,
  className,
  size = "md",
}: FollowButtonProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [pending, setPending] = useState(false);

  // Hydrate follow status on mount / when target changes.
  useEffect(() => {
    if (!user || user.id === targetUserId) {
      setHydrating(false);
      return;
    }
    const c = new AbortController();
    void (async () => {
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
  }, [user, targetUserId]);

  if (!user || (status?.isSelf ?? user.id === targetUserId)) {
    return null;
  }

  const isFollowing = status?.isFollowing ?? false;

  const handleClick = async () => {
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
      // Roll back.
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

  const sizing =
    size === "sm" ? "px-3.5 py-1.5 text-[11px]" : "px-5 py-2.5 text-xs";

  if (hydrating) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center gap-2 rounded-full border",
          "border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "animate-pulse text-transparent",
          sizing,
          className,
        )}
      >
        <span className="h-3 w-3" />
        <span>Követés</span>
      </span>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={pending}
      whileTap={{ scale: 0.96 }}
      aria-pressed={isFollowing}
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-display uppercase tracking-[0.18em]",
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
        <Loader2 size={13} className="animate-spin" aria-hidden />
      ) : isFollowing ? (
        <Check size={13} aria-hidden />
      ) : (
        <UserPlus size={13} aria-hidden />
      )}
      <span>{isFollowing ? "Követed" : "Követés"}</span>
    </motion.button>
  );
}
