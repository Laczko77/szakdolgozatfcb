"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, Trash2 } from "lucide-react";
import type { EnrichedPost, AuthorSnapshot, OwnReaction } from "@/types/social";
import { Avatar } from "./Avatar";
import { ReactionBar } from "./ReactionBar";
import { CommentSection } from "./CommentSection";
import { Lightbox } from "./Lightbox";
import { RelativeTime } from "./RelativeTime";
import { cn } from "@/lib/utils";

/**
 * F11.1 — Glass card representing a single feed post.
 *
 * Visual structure (top → bottom):
 *   1. Author row: avatar, display name, optional admin pip, timestamp
 *      and an admin-only delete chevron on the far right.
 *   2. Body text — preserves the author's line breaks, hardly any
 *      formatting beyond that, this is a feed not a CMS.
 *   3. Optional image — clipped 16:10, click to open the lightbox.
 *   4. Reaction bar.
 *   5. Comment section (collapsed by default).
 *
 * The card itself is not a link target; clickable affordances are
 * limited to the image, reaction bar, and the comment toggle to keep
 * accidental nav events out of the timeline.
 */
interface PostCardProps {
  post: EnrichedPost;
  author: AuthorSnapshot | null;
  /** Render the staggered entry animation? Disabled for newly-polled posts. */
  index: number;
  ownReaction: OwnReaction | undefined;
  isAdmin: boolean;
  canReact: boolean;
  authorCache: Record<string, AuthorSnapshot | undefined>;
  onResolveAuthors: (userIds: string[]) => Promise<void>;
  onReactAdd: (emoji: string) => Promise<void>;
  onReactSwap: (emoji: string) => Promise<void>;
  onReactRevoke: () => Promise<void>;
  onRequireLogin: () => void;
  onAdminDelete?: () => Promise<void>;
}

export function PostCard({
  post,
  author,
  index,
  ownReaction,
  isAdmin,
  canReact,
  authorCache,
  onResolveAuthors,
  onReactAdd,
  onReactSwap,
  onReactRevoke,
  onRequireLogin,
  onAdminDelete,
}: PostCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // BUG-014 — track the "confirm window" timer in a ref so we can
  // cancel it on unmount (or before scheduling a new one). Without
  // this, an admin who clicks "Törlés" then navigates away triggers a
  // setState on an unmounted component 4s later — a benign React
  // warning today, a real memory leak in long-lived feed sessions.
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
        confirmTimeoutRef.current = null;
      }
    };
  }, []);

  // F25.1 — prefer the JOIN-ed author the API may now ship inline; fall
  // back to the lazy `authorCache` lookup; finally render an "unknown
  // fan" placeholder rather than the meaningless "FCB" default that
  // confused logged-in users when an author profile failed to resolve.
  const resolvedAuthor = post.author ?? author ?? null;
  const displayName = resolvedAuthor?.username || "Ismeretlen szurkoló";
  const isAuthorAdmin = resolvedAuthor?.role === "admin";

  // F26.1 — the follow CTA was removed from feed cards entirely. The
  // public profile (/profil/[id]) is the canonical place to follow,
  // reachable via the avatar/username link below.

  const handleDelete = async () => {
    if (!onAdminDelete || deleting) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      // Clear any prior timer first — if the admin clicks "Törlés"
      // twice in quick succession we want a fresh 4s window, not two
      // overlapping ones racing each other.
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmingDelete(false);
        confirmTimeoutRef.current = null;
      }, 4000);
      return;
    }
    // Confirmed — cancel the auto-reset timer so it can't flip the
    // button label mid-delete.
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
    setDeleting(true);
    try {
      await onAdminDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.article
      // Staggered entry, but capped — past index 5 we stop adding delay
      // so a long load-more burst doesn't take ages to materialise.
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: Math.min(index * 0.04, 0.25),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      className={cn(
        "glass-card",
        "relative flex flex-col gap-4 p-5 sm:p-6",
      )}
    >
      {/* Author row — avatar + name link to the public profile */}
      <header className="flex items-start gap-3">
        <Link
          href={`/profil/${post.author_id}`}
          className={cn(
            "group/auth flex min-w-0 flex-1 items-start gap-3",
            "rounded-[var(--radius-md)] -m-1 p-1",
            "transition-colors hover:bg-[var(--glass-bg-hover)]/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
          )}
        >
          <Avatar url={resolvedAuthor?.avatar_url ?? null} name={displayName} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-display text-base tracking-wide text-[var(--text-primary)] transition-colors group-hover/auth:text-[var(--accent-gold)]">
                {displayName}
              </span>
              {isAuthorAdmin && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]",
                    "border border-[var(--accent-gold)] text-[var(--accent-gold)]",
                  )}
                  aria-label="Hivatalos klubadmin"
                >
                  <ShieldCheck size={10} aria-hidden />
                  Klubadmin
                </span>
              )}
            </div>
            <RelativeTime
              iso={post.created_at}
              className="text-xs text-[var(--text-muted)]"
            />
          </div>
        </Link>

        {isAdmin && onAdminDelete && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            aria-label={
              confirmingDelete ? "Törlés megerősítése" : "Poszt törlése"
            }
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] transition",
              confirmingDelete
                ? "border border-[var(--accent-red)] bg-[var(--accent-red-subtle)] text-[var(--accent-red)]"
                : "text-[var(--text-muted)] hover:text-[var(--accent-red)]",
              deleting && "opacity-50",
            )}
          >
            <Trash2 size={12} aria-hidden />
            {confirmingDelete ? "Megerősítés" : "Törlés"}
          </button>
        )}
      </header>

      {/* Body */}
      {post.content && (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[var(--text-primary)]">
          {post.content}
        </p>
      )}

      {/* Optional image */}
      {post.image_url && (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          aria-label="Kép megnyitása teljes méretben"
          className={cn(
            "group relative -mx-1 overflow-hidden rounded-2xl border border-[var(--glass-border)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
          )}
        >
          <span className="relative block aspect-[16/10] w-full bg-[var(--bg-secondary)]">
            <Image
              src={post.image_url}
              alt=""
              fill
              sizes="(min-width: 640px) 600px, 100vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
              unoptimized
            />
          </span>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        </button>
      )}

      {/* Reactions */}
      <div>
        <ReactionBar
          targetType="post"
          targetId={post.id}
          reactions={post.reactions}
          ownReaction={ownReaction}
          canReact={canReact}
          onAdd={onReactAdd}
          onSwap={onReactSwap}
          onRevoke={onReactRevoke}
          onRequireLogin={onRequireLogin}
        />
      </div>

      {/* Comments */}
      <CommentSection
        postId={post.id}
        initialCount={post.commentCount}
        postAuthorId={post.author_id}
        authorCache={authorCache}
        onResolveAuthors={onResolveAuthors}
      />

      <Lightbox
        src={lightboxOpen ? post.image_url : null}
        alt={`Poszt képe — ${displayName}`}
        onClose={() => setLightboxOpen(false)}
      />
    </motion.article>
  );
}
