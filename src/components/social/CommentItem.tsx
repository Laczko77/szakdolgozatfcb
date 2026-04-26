"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import type { EnrichedComment, AuthorSnapshot, OwnReaction } from "@/types/social";
import { RelativeTime } from "./RelativeTime";
import { ReactionBar } from "./ReactionBar";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

/**
 * Single comment row used inside {@link CommentSection}.
 *
 * Layout: avatar gutter on the left, then a single-bubble glass card
 * containing the username, timestamp, body text, the inline reaction
 * bar, and (only for the comment's owner or an admin) a small delete
 * affordance.
 *
 * Delete uses an inline two-step confirmation rather than a modal —
 * the action is reversible only by re-typing, and a modal would feel
 * disproportionate inside a comment thread.
 */
interface CommentItemProps {
  comment: EnrichedComment;
  author: AuthorSnapshot | null;
  currentUserId: string | null;
  isAdmin: boolean;
  ownReaction: OwnReaction | undefined;
  onReact: (emoji: string) => Promise<void>;
  onSwap: (emoji: string) => Promise<void>;
  onRevoke: () => Promise<void>;
  onRequireLogin: () => void;
  onDelete: () => Promise<void>;
}

export function CommentItem({
  comment,
  author,
  currentUserId,
  isAdmin,
  ownReaction,
  onReact,
  onSwap,
  onRevoke,
  onRequireLogin,
  onDelete,
}: CommentItemProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const canDelete = isAdmin || comment.user_id === currentUserId;

  const handleDelete = async () => {
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      // Auto-cancel the confirmation after a few seconds so a stray
      // click doesn't leave the row in a primed state.
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  };

  const displayName = author?.username || "Vendég";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <Avatar
        url={author?.avatar_url ?? null}
        name={displayName}
        size={32}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div
          className={cn(
            "rounded-2xl border px-3.5 py-2.5",
            "border-[var(--glass-border)] bg-[var(--glass-bg)]",
          )}
        >
          <div className="flex items-baseline gap-2 text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              {displayName}
            </span>
            {author?.role === "admin" && (
              <span
                className="rounded-full border border-[var(--accent-gold)] px-1.5 py-px text-[9px] uppercase tracking-[0.18em] text-[var(--accent-gold)]"
                aria-label="Admin"
              >
                Admin
              </span>
            )}
            <RelativeTime
              iso={comment.created_at}
              className="text-[var(--text-muted)]"
            />
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-primary)]">
            {comment.content}
          </p>
        </div>

        <div className="flex items-center gap-2 pl-1">
          <ReactionBar
            targetType="comment"
            targetId={comment.id}
            reactions={comment.reactions}
            ownReaction={ownReaction}
            canReact={Boolean(currentUserId)}
            onAdd={onReact}
            onSwap={onSwap}
            onRevoke={onRevoke}
            onRequireLogin={onRequireLogin}
            compact
          />

          {canDelete && (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition",
                confirming
                  ? "border border-[var(--accent-red)] bg-[var(--accent-red-subtle)] text-[var(--accent-red)]"
                  : "text-[var(--text-muted)] hover:text-[var(--accent-red)]",
                busy && "opacity-50",
              )}
              aria-label={confirming ? "Törlés megerősítése" : "Komment törlése"}
            >
              <Trash2 size={11} aria-hidden />
              {confirming ? "Megerősítés" : "Törlés"}
            </button>
          )}
        </div>
      </div>
    </motion.li>
  );
}
