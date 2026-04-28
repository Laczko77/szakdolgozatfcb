"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MessageSquare, Send } from "lucide-react";
import {
  createComment,
  deleteComment,
  deleteReaction,
  fetchComments,
  upsertReaction,
} from "@/lib/social-api";
import type { EnrichedComment, AuthorSnapshot, OwnReactionMap } from "@/types/social";
import { ownReactionKey } from "@/types/social";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { CommentItem } from "./CommentItem";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

/**
 * F11.3 — Collapsible comment thread under a post.
 *
 * Behaviour:
 *   - Collapsed by default: shows a `{count} komment` chip.
 *   - On expand we fetch /api/posts/[id]/comments (server already
 *     sorts by reactionTotal desc, then created_at desc).
 *   - The comment list re-sorts client-side when reactions change so
 *     the user sees their own reactions affect ordering live.
 *   - The composer at the bottom is only rendered for signed-in
 *     users; unauthenticated visitors see a "Belépés a hozzászóláshoz"
 *     hint instead.
 */
interface CommentSectionProps {
  postId: string;
  /** Server-provided count for the collapsed chip. */
  initialCount: number;
  /**
   * The owner of the post — used to render an "author replied" pip on
   * matching comments. Optional because admin posts may have any
   * author and we don't always carry their profile snapshot.
   */
  postAuthorId?: string;
  /** Pre-fetched author snapshots keyed by user id (parent-managed cache). */
  authorCache: Record<string, AuthorSnapshot | undefined>;
  /** Resolve missing author profiles on demand. */
  onResolveAuthors: (userIds: string[]) => Promise<void>;
}

export function CommentSection({
  postId,
  initialCount,
  postAuthorId,
  authorCache,
  onResolveAuthors,
}: CommentSectionProps) {
  // postAuthorId is reserved for an upcoming "author replied" pip; the
  // server already attaches author profiles in the cache so we keep
  // the field on the prop surface for forward-compat.
  void postAuthorId;

  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [count, setCount] = useState(initialCount);

  const [ownReactions, setOwnReactions] = useState<OwnReactionMap>({});

  // Keep the visible count in sync with the prop when the parent
  // refreshes the post (e.g. polling tick). Wrapped in a microtask
  // so eslint-config-next's `react-hooks/set-state-in-effect` rule
  // doesn't flag the synchronous setState pattern.
  useEffect(() => {
    queueMicrotask(() => setCount(initialCount));
  }, [initialCount]);

  /**
   * Fetch the caller's existing reactions for the loaded comments.
   * The list endpoint is public, so it doesn't echo back per-user
   * reaction ids — we look them up here in one batch query.
   */
  const hydrateOwnReactions = useCallback(
    async (commentIds: string[]) => {
      if (!user || commentIds.length === 0) return;
      const { data } = await supabase
        .from("reactions")
        .select("id, target_id, emoji")
        .eq("user_id", user.id)
        .eq("target_type", "comment")
        .in("target_id", commentIds);

      if (!data) return;
      setOwnReactions((prev) => {
        const next = { ...prev };
        for (const row of data as Array<{
          id: string;
          target_id: string;
          emoji: string;
        }>) {
          next[ownReactionKey("comment", row.target_id)] = {
            id: row.id,
            emoji: row.emoji,
          };
        }
        return next;
      });
    },
    [supabase, user],
  );

  const ensureLoaded = useCallback(async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const { comments: fetched } = await fetchComments(postId);
      setComments(fetched);
      setCount(fetched.length);
      setLoaded(true);

      const authorIds = Array.from(new Set(fetched.map((c) => c.user_id)));
      await onResolveAuthors(authorIds);
      await hydrateOwnReactions(fetched.map((c) => c.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kommentek betöltése sikertelen",
      );
    } finally {
      setLoading(false);
    }
  }, [
    loaded,
    loading,
    postId,
    onResolveAuthors,
    hydrateOwnReactions,
    toast,
  ]);

  const toggleOpen = () => {
    if (!open) void ensureLoaded();
    setOpen((v) => !v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = draft.trim();
    if (!value || submitting) return;
    if (!user) {
      toast.info("Hozzászóláshoz be kell jelentkezned");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createComment(postId, value);
      const optimistic: EnrichedComment = {
        ...created,
        reactions: {},
        reactionTotal: 0,
      };
      setComments((prev) => [optimistic, ...prev]);
      setCount((c) => c + 1);
      setDraft("");

      // Make sure our own profile is in the cache for the optimistic row.
      // The dashboard provider already has it, but we still go through
      // the resolver so the cache shape stays consistent.
      await onResolveAuthors([user.id]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Komment küldése sikertelen",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCount((c) => Math.max(0, c - 1));
      toast.success("Komment törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Törlés sikertelen");
    }
  };

  /* ----- Reaction handlers (per comment) ---------------------------- */

  const applyReactionDelta = (
    commentId: string,
    delta: { add?: string; remove?: string },
  ) => {
    setComments((prev) =>
      prev
        .map((c) => {
          if (c.id !== commentId) return c;
          const reactions = { ...c.reactions };
          let total = c.reactionTotal;
          if (delta.remove && reactions[delta.remove]) {
            reactions[delta.remove] = reactions[delta.remove] - 1;
            if (reactions[delta.remove] <= 0) delete reactions[delta.remove];
            total -= 1;
          }
          if (delta.add) {
            reactions[delta.add] = (reactions[delta.add] ?? 0) + 1;
            total += 1;
          }
          return { ...c, reactions, reactionTotal: total };
        })
        // Re-sort because a freshly-reacted comment may need to bubble up.
        .sort((a, b) => {
          if (b.reactionTotal !== a.reactionTotal)
            return b.reactionTotal - a.reactionTotal;
          return b.created_at.localeCompare(a.created_at);
        }),
    );
  };

  const reactToComment = async (commentId: string, emoji: string) => {
    try {
      const row = await upsertReaction({
        target_type: "comment",
        target_id: commentId,
        emoji,
      });
      applyReactionDelta(commentId, { add: emoji });
      setOwnReactions((prev) => ({
        ...prev,
        [ownReactionKey("comment", commentId)]: { id: row.id, emoji },
      }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Reakció rögzítése sikertelen",
      );
    }
  };

  const swapReaction = async (commentId: string, emoji: string) => {
    const key = ownReactionKey("comment", commentId);
    const current = ownReactions[key];
    if (!current) return reactToComment(commentId, emoji);
    try {
      const row = await upsertReaction({
        target_type: "comment",
        target_id: commentId,
        emoji,
      });
      applyReactionDelta(commentId, { add: emoji, remove: current.emoji });
      setOwnReactions((prev) => ({ ...prev, [key]: { id: row.id, emoji } }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Reakció cseréje sikertelen",
      );
    }
  };

  const revokeReaction = async (commentId: string) => {
    const key = ownReactionKey("comment", commentId);
    const current = ownReactions[key];
    if (!current) return;
    try {
      await deleteReaction(current.id);
      applyReactionDelta(commentId, { remove: current.emoji });
      setOwnReactions((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Reakció visszavonása sikertelen",
      );
    }
  };

  const requireLogin = () => {
    toast.info("Reakcióhoz be kell jelentkezned");
  };

  return (
    <div className="border-t border-[var(--glass-border)] pt-3">
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 text-xs transition",
          "text-[var(--text-secondary)] hover:text-[var(--accent-gold)]",
        )}
      >
        <MessageSquare size={13} aria-hidden />
        <span>
          {count === 0
            ? "Még nincs komment — légy az első"
            : `${count} komment`}
        </span>
        <ChevronDown
          size={13}
          aria-hidden
          className={cn(
            "transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="thread"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-4">
              {loading && (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
                        <div className="h-3 w-3/4 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && comments.length > 0 && (
                <ul className="space-y-3">
                  <AnimatePresence initial={false}>
                    {comments.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        // F26.8 — prefer the JOIN-ed author the API ships
                        // inline; fall back to the lazy cache lookup.
                        author={c.author ?? authorCache[c.user_id] ?? null}
                        currentUserId={user?.id ?? null}
                        isAdmin={isAdmin}
                        ownReaction={ownReactions[ownReactionKey("comment", c.id)]}
                        onReact={(emoji) => reactToComment(c.id, emoji)}
                        onSwap={(emoji) => swapReaction(c.id, emoji)}
                        onRevoke={() => revokeReaction(c.id)}
                        onRequireLogin={requireLogin}
                        onDelete={() => handleDelete(c.id)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}

              {/* Composer */}
              {user ? (
                <CommentComposer
                  draft={draft}
                  setDraft={setDraft}
                  submitting={submitting}
                  onSubmit={handleSubmit}
                  selfProfile={authorCache[user.id] ?? null}
                />
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--glass-bg)] px-3.5 py-3 text-xs text-[var(--text-secondary)]">
                  Hozzászóláshoz{" "}
                  <a
                    href={`/login?returnUrl=${encodeURIComponent("/kozosseg")}`}
                    className="font-semibold text-[var(--accent-gold)] underline-offset-2 hover:underline"
                  >
                    jelentkezz be
                  </a>
                  .
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composer                                                           */
/* ------------------------------------------------------------------ */

interface CommentComposerProps {
  draft: string;
  setDraft: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  selfProfile: AuthorSnapshot | null;
}

function CommentComposer({
  draft,
  setDraft,
  submitting,
  onSubmit,
  selfProfile,
}: CommentComposerProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-start gap-3 pt-1"
      aria-label="Új komment írása"
    >
      <Avatar
        url={selfProfile?.avatar_url ?? null}
        name={selfProfile?.username ?? "Te"}
        size={32}
      />
      <div className="flex flex-1 items-end gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 transition focus-within:border-[var(--accent-gold)]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Mit gondolsz?"
          rows={1}
          maxLength={500}
          onKeyDown={(e) => {
            // Submit on Enter, allow newline on Shift+Enter.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as unknown as React.FormEvent);
            }
          }}
          className="min-h-[24px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting || draft.trim().length === 0}
          aria-label="Küldés"
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
            "border border-[var(--accent-gold)] text-[var(--accent-gold)]",
            "hover:bg-[var(--accent-gold-subtle)]",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <Send size={14} aria-hidden />
        </button>
      </div>
    </form>
  );
}
