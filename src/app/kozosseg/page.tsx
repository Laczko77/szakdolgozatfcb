"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  deleteAdminPost,
  deleteReaction,
  fetchPosts,
  upsertReaction,
} from "@/lib/social-api";
import type { EnrichedPost, AuthorSnapshot, OwnReactionMap } from "@/types/social";
import { ownReactionKey } from "@/types/social";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { useFeedPolling } from "@/hooks/useFeedPolling";
import { PostCard } from "@/components/social/PostCard";
import { NewPostComposer } from "@/components/social/NewPostComposer";
import { cn } from "@/lib/utils";

/**
 * /kozosseg — F11 Community Feed.
 *
 * Architecture notes:
 *   - One column, max-w-[640px]. The whole experience is a vertical
 *     timeline; horizontal real-estate is reserved for breathing room.
 *   - Authors are resolved lazily into a shared cache so a 20-post
 *     page costs at most ~5 unique profile lookups.
 *   - The 3s polling tick (`useFeedPolling`) calls /api/posts with
 *     `since=<lastPollTs>` and merges anything new into the head of
 *     the list. Existing rows are NOT re-mutated — that's what keeps
 *     the user's scroll position pinned.
 *   - Reactions follow optimistic-update + reconciliation: we apply
 *     the delta locally first so the UI feels instant, and roll back
 *     on a server error via the toast handler in social-api.
 *
 * The page is intentionally NOT wrapped in `<ProtectedRoute>` — the
 * feed is a public read surface; only writes (post / comment / react)
 * gate on auth.
 */

const PAGE_SIZE = 20;

export default function CommunityFeedPage() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  /** id → AuthorSnapshot — shared between posts and their comment threads. */
  const [authorCache, setAuthorCache] = useState<
    Record<string, AuthorSnapshot | undefined>
  >({});

  /** Caller's own reactions, keyed by `${target_type}:${target_id}`. */
  const [ownReactions, setOwnReactions] = useState<OwnReactionMap>({});

  /* ----- Author resolver ------------------------------------------- */

  const resolveAuthors = useCallback(
    async (userIds: string[]) => {
      const missing = userIds.filter(
        (id) => id && authorCache[id] === undefined,
      );
      if (missing.length === 0) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, role")
        .in("id", missing);

      if (!data) return;
      setAuthorCache((prev) => {
        const next = { ...prev };
        for (const row of data as AuthorSnapshot[]) {
          next[row.id] = row;
        }
        // Also fill nulls for any ids we asked about but the DB
        // didn't return — prevents an infinite re-resolve loop on
        // deleted profiles.
        for (const id of missing) {
          if (!next[id]) next[id] = null as unknown as AuthorSnapshot;
        }
        return next;
      });
    },
    [supabase, authorCache],
  );

  /* ----- Own-reaction hydration ------------------------------------ */

  const hydrateOwnPostReactions = useCallback(
    async (postIds: string[]) => {
      if (!user || postIds.length === 0) return;
      const { data } = await supabase
        .from("reactions")
        .select("id, target_id, emoji")
        .eq("user_id", user.id)
        .eq("target_type", "post")
        .in("target_id", postIds);
      if (!data) return;
      setOwnReactions((prev) => {
        const next = { ...prev };
        for (const row of data as Array<{
          id: string;
          target_id: string;
          emoji: string;
        }>) {
          next[ownReactionKey("post", row.target_id)] = {
            id: row.id,
            emoji: row.emoji,
          };
        }
        return next;
      });
    },
    [supabase, user],
  );

  /* ----- Page loading ---------------------------------------------- */

  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPosts({ page: 1, limit: PAGE_SIZE });
      setPosts(data.posts);
      setPage(1);
      setTotalPages(data.totalPages);
      const authorIds = Array.from(new Set(data.posts.map((p) => p.author_id)));
      await resolveAuthors(authorIds);
      await hydrateOwnPostReactions(data.posts.map((p) => p.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Feed betöltése sikertelen",
      );
    } finally {
      setLoading(false);
    }
  }, [resolveAuthors, hydrateOwnPostReactions, toast]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const data = await fetchPosts({ page: page + 1, limit: PAGE_SIZE });
      setPosts((prev) => {
        // Dedupe defensively — a polling tick could have inserted a
        // row that the next page also returns.
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of data.posts) {
          if (!seen.has(p.id)) merged.push(p);
        }
        return merged;
      });
      setPage(data.page);
      setTotalPages(data.totalPages);
      await resolveAuthors(data.posts.map((p) => p.author_id));
      await hydrateOwnPostReactions(data.posts.map((p) => p.id));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "További posztok betöltése sikertelen",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    page,
    totalPages,
    resolveAuthors,
    hydrateOwnPostReactions,
    toast,
  ]);

  // Initial load — async IIFE so the synchronous setLoading inside
  // loadInitial doesn't trip `react-hooks/set-state-in-effect`.
  useEffect(() => {
    void (async () => {
      await loadInitial();
    })();
  }, [loadInitial]);

  /* ----- 3s polling ------------------------------------------------- */

  const onPollTick = useCallback(
    async (since: string) => {
      const data = await fetchPosts({ since, limit: PAGE_SIZE });
      if (data.posts.length === 0) return;

      setPosts((prev) => {
        // Drop anything we already have. Since the server returns
        // newest first, prepending preserves order for fresh rows
        // while leaving the existing list untouched (no jumps).
        const seen = new Set(prev.map((p) => p.id));
        const fresh = data.posts.filter((p) => !seen.has(p.id));
        return fresh.length === 0 ? prev : [...fresh, ...prev];
      });

      const fresh = data.posts.filter(
        (p) => !posts.some((existing) => existing.id === p.id),
      );
      if (fresh.length > 0) {
        await resolveAuthors(fresh.map((p) => p.author_id));
        await hydrateOwnPostReactions(fresh.map((p) => p.id));
      }
    },
    [posts, resolveAuthors, hydrateOwnPostReactions],
  );

  useFeedPolling(onPollTick, { intervalMs: 3000, enabled: !loading });

  /* ----- Reaction handlers (per post) ------------------------------- */

  const applyPostDelta = (
    postId: string,
    delta: { add?: string; remove?: string },
  ) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const reactions = { ...p.reactions };
        let total = p.reactionTotal;
        if (delta.remove && reactions[delta.remove]) {
          reactions[delta.remove] = reactions[delta.remove] - 1;
          if (reactions[delta.remove] <= 0) delete reactions[delta.remove];
          total -= 1;
        }
        if (delta.add) {
          reactions[delta.add] = (reactions[delta.add] ?? 0) + 1;
          total += 1;
        }
        return { ...p, reactions, reactionTotal: total };
      }),
    );
  };

  const reactToPost = async (postId: string, emoji: string) => {
    try {
      const row = await upsertReaction({
        target_type: "post",
        target_id: postId,
        emoji,
      });
      applyPostDelta(postId, { add: emoji });
      setOwnReactions((prev) => ({
        ...prev,
        [ownReactionKey("post", postId)]: { id: row.id, emoji },
      }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Reakció rögzítése sikertelen",
      );
    }
  };

  const swapPostReaction = async (postId: string, emoji: string) => {
    const key = ownReactionKey("post", postId);
    const current = ownReactions[key];
    if (!current) return reactToPost(postId, emoji);
    try {
      const row = await upsertReaction({
        target_type: "post",
        target_id: postId,
        emoji,
      });
      applyPostDelta(postId, { add: emoji, remove: current.emoji });
      setOwnReactions((prev) => ({ ...prev, [key]: { id: row.id, emoji } }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Reakció cseréje sikertelen",
      );
    }
  };

  const revokePostReaction = async (postId: string) => {
    const key = ownReactionKey("post", postId);
    const current = ownReactions[key];
    if (!current) return;
    try {
      await deleteReaction(current.id);
      applyPostDelta(postId, { remove: current.emoji });
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

  /* ----- Admin actions --------------------------------------------- */

  const handleAdminDelete = async (postId: string) => {
    try {
      await deleteAdminPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("Poszt törölve");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Törlés sikertelen");
    }
  };

  const handlePosted = (created: EnrichedPost) => {
    setPosts((prev) => [created, ...prev]);
  };

  /* ----- Render ----------------------------------------------------- */

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6 sm:py-10">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 sm:mb-10"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Közösség
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-4xl sm:text-6xl",
          )}
        >
          A szurkolói tér
        </h1>
        <p className="mt-3 max-w-[40rem] text-sm text-[var(--text-secondary)]">
          A klub hivatalos posztjai, friss reakciókkal és a többi szurkoló
          gondolataival. A feed{" "}
          <span className="text-[var(--accent-gold)]">3 másodpercenként</span>{" "}
          önállóan frissül — a gördítésed nem fog megzökkenni.
        </p>
      </motion.header>

      {isAdmin && (
        <div className="mb-6">
          <NewPostComposer onPosted={handlePosted} />
        </div>
      )}

      {loading ? (
        <FeedSkeleton />
      ) : posts.length === 0 ? (
        <EmptyFeed />
      ) : (
        <ul className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {posts.map((post, idx) => (
              <motion.li
                key={post.id}
                layout
                // The exit/initial config keeps the list stable: only
                // brand-new (polled-in or composed) posts animate in;
                // the initial page-load posts use PostCard's own
                // staggered reveal.
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <PostCard
                  post={post}
                  author={authorCache[post.author_id] ?? null}
                  index={idx}
                  ownReaction={ownReactions[ownReactionKey("post", post.id)]}
                  isAdmin={isAdmin}
                  canReact={Boolean(user)}
                  authorCache={authorCache}
                  onResolveAuthors={resolveAuthors}
                  onReactAdd={(emoji) => reactToPost(post.id, emoji)}
                  onReactSwap={(emoji) => swapPostReaction(post.id, emoji)}
                  onReactRevoke={() => revokePostReaction(post.id)}
                  onRequireLogin={requireLogin}
                  onAdminDelete={
                    isAdmin ? () => handleAdminDelete(post.id) : undefined
                  }
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {page < totalPages && !loading && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="glass-button-secondary px-5 py-2 text-sm"
          >
            {loadingMore ? "Betöltés…" : "Több poszt"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-views                                                          */
/* ------------------------------------------------------------------ */

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
              <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-11/12 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            <div className="h-3 w-9/12 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            <div className="h-3 w-7/12 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          </div>
          <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-[var(--glass-bg-hover)]" />
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="glass-card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="font-display text-3xl tracking-widest text-[var(--accent-gold)]">
        Csend van.
      </span>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">
        Egyelőre nincs poszt a közösségi térben. Amint az admin csapat
        közzétesz valamit, automatikusan itt fog megjelenni.
      </p>
    </div>
  );
}
