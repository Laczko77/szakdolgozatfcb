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
 * Middle column on /kozosseg. The same feed engine that previously lived
 * directly in `app/kozosseg/page.tsx` — extracted in F23 so the page
 * shell can frame it in a 3-column layout (left rail nav + this feed +
 * right rail widgets) without bloating the page file.
 *
 * All polling, optimistic-reaction, and admin-action behaviour is
 * preserved verbatim from the F11 implementation.
 */

const PAGE_SIZE = 20;

export function CommunityFeed() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [authorCache, setAuthorCache] = useState<
    Record<string, AuthorSnapshot | undefined>
  >({});

  const [ownReactions, setOwnReactions] = useState<OwnReactionMap>({});

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
        for (const id of missing) {
          if (!next[id]) next[id] = null as unknown as AuthorSnapshot;
        }
        return next;
      });
    },
    [supabase, authorCache],
  );

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

  useEffect(() => {
    void (async () => {
      await loadInitial();
    })();
  }, [loadInitial]);

  const onPollTick = useCallback(
    async (since: string) => {
      const data = await fetchPosts({ since, limit: PAGE_SIZE });
      if (data.posts.length === 0) return;

      setPosts((prev) => {
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

  return (
    <div className="w-full">
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
          <div className={cn("aspect-[16/10] w-full animate-pulse rounded-2xl bg-[var(--glass-bg-hover)]")} />
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
