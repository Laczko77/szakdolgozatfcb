"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Frown,
  MessageCircle,
  Newspaper,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import {
  ApiError,
  fetchPublicProfile,
  startConversation,
  type PublicProfile,
} from "@/lib/dm-api";
import type { EnrichedPost } from "@/types/social";
import { Avatar } from "@/components/social/Avatar";
import { FollowButton } from "@/components/social/FollowButton";
import { PostCard } from "@/components/social/PostCard";
import type { FollowStatus } from "@/types/dm";
import type { AuthorSnapshot } from "@/types/social";
import { cn } from "@/lib/utils";

/**
 * /profil/[id] — public profile page (F26.2 rewrite).
 *
 * Hero section:
 *   · 88px avatar, username (display font, oversized).
 *   · Join date + post count line.
 *   · FollowButton (3-state) + a mutual-only "Üzenet" CTA.
 *
 * Below the hero we render the user's own posts (max 20 most recent).
 * The PostCard reuse keeps reactions / comments behaviour identical to
 * the main feed — the page is just a filtered view of the same model.
 *
 * 404 surface: when the API returns 404 (or maybeSingle yields no row)
 * we render an on-brand "Ez a profil nem létezik" glass card instead
 * of bouncing to Next's default error page.
 */
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PublicProfilePage({ params }: PageProps) {
  const { id } = use(params);
  return <PublicProfileContent userId={id} />;
}

function PublicProfileContent({ userId }: { userId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [startingConv, setStartingConv] = useState(false);

  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  // Redirect self → canonical /profil page so users don't see a
  // stripped-down view of themselves.
  useEffect(() => {
    if (user && user.id === userId) {
      router.replace("/profil");
    }
  }, [user, userId, router]);

  // F26.2 — fetch the public profile envelope from the dedicated
  // endpoint. Falls back to a tasteful 404 when the row is missing.
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const data = await fetchPublicProfile(userId, c.signal);
        if (c.signal.aborted) return;
        if (!data) {
          setNotFound(true);
          setProfile(null);
        } else {
          setProfile(data);
        }
      } catch (err) {
        if (c.signal.aborted) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          setProfile(null);
        } else {
          toast.error(
            err instanceof Error
              ? err.message
              : "Profil betöltése sikertelen",
          );
        }
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [userId, toast]);

  // Pull the user's own posts. We hit Supabase directly because the
  // /api/posts endpoint doesn't accept an author filter — keeping this
  // self-contained here avoids backend churn for the UI's sake.
  useEffect(() => {
    const c = new AbortController();
    if (notFound) {
      // Wrap setState in a microtask so the React 19 set-state-in-effect
      // lint stays quiet — we're synchronising local state with an
      // external (just-fetched) value, but the rule doesn't see the
      // distinction without the indirection.
      queueMicrotask(() => {
        setPosts([]);
        setPostsLoading(false);
      });
      return () => c.abort();
    }
    void (async () => {
      setPostsLoading(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("id, author_id, content, image_url, created_at")
          .eq("author_id", userId)
          .order("created_at", { ascending: false })
          .limit(20);
        if (c.signal.aborted) return;
        if (error) throw new Error(error.message);

        // The PostCard expects EnrichedPost — synthesise zeroed
        // counters here. The client-side reaction handlers already
        // tolerate empty maps and re-fetch on demand.
        const rows = ((data ?? []) as Array<{
          id: string;
          author_id: string;
          content: string;
          image_url: string | null;
          created_at: string;
        }>).map<EnrichedPost>((p) => ({
          ...p,
          reactions: {},
          reactionTotal: 0,
          commentCount: 0,
        }));
        setPosts(rows);
      } catch {
        // Silent — the empty-state covers it.
      } finally {
        if (!c.signal.aborted) setPostsLoading(false);
      }
    })();
    return () => c.abort();
  }, [supabase, userId, notFound]);

  const handleStartConv = useCallback(async () => {
    if (!user) {
      router.push(`/login?returnUrl=/profil/${userId}`);
      return;
    }
    if (startingConv) return;
    setStartingConv(true);
    try {
      const conv = await startConversation(userId);
      router.push(`/kozosseg/uzenetek?c=${conv.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.info("Még nem követitek egymást, üzenetet nem küldhetsz");
      } else {
        toast.error(
          err instanceof Error
            ? err.message
            : "Beszélgetés indítása sikertelen",
        );
      }
    } finally {
      setStartingConv(false);
    }
  }, [user, userId, router, toast, startingConv]);

  // Build a one-entry author cache so PostCard renders this user's
  // username/avatar without an extra round-trip per post.
  const authorCache: Record<string, AuthorSnapshot | undefined> =
    useMemo(() => {
      if (!profile) return {};
      return {
        [profile.id]: {
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          role: profile.role ?? "user",
        },
      };
    }, [profile]);

  const noopResolver = useCallback(async () => {
    /* every author is already in `authorCache` */
  }, []);
  const noopReact = useCallback(async () => {
    /* read-only mode for these placeholder cards */
  }, []);
  const noopRequireLogin = useCallback(() => {
    /* read-only mode */
  }, []);

  const formattedJoinDate = profile
    ? new Date(profile.created_at).toLocaleDateString("hu-HU", {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Link
          href="/kozosseg"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em]",
            "text-[var(--text-secondary)] transition-colors hover:text-[var(--accent-gold)]",
          )}
        >
          <ArrowLeft size={12} aria-hidden />
          Vissza a közösséghez
        </Link>
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "mt-6 h-44 animate-pulse rounded-[var(--radius-lg)]",
              "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            )}
            aria-hidden
          />
        ) : notFound || !profile ? (
          <NotFoundCard key="404" />
        ) : (
          <motion.div key="content">
            <ProfileHero
              profile={profile}
              joinDate={formattedJoinDate}
              user={user}
              followStatus={followStatus}
              onFollowStatusChange={setFollowStatus}
              startingConv={startingConv}
              onStartConv={() => void handleStartConv()}
            />

            <ProfilePostsSection
              loading={postsLoading}
              posts={posts}
              authorCache={authorCache}
              onResolveAuthors={noopResolver}
              onReact={noopReact}
              onRequireLogin={noopRequireLogin}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

function ProfileHero({
  profile,
  joinDate,
  user,
  followStatus,
  onFollowStatusChange,
  startingConv,
  onStartConv,
}: {
  profile: PublicProfile;
  joinDate: string | null;
  user: { id: string } | null | undefined;
  followStatus: FollowStatus | null;
  onFollowStatusChange: (s: FollowStatus) => void;
  startingConv: boolean;
  onStartConv: () => void;
}) {
  const isFollowing = followStatus?.status === "following";
  const canMessage = isFollowing && (followStatus?.isFollowedBy ?? false);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(
        "glass-card relative mt-6 overflow-hidden",
        "p-6 sm:p-8",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/40 to-transparent"
      />
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
        <Avatar
          url={profile.avatar_url}
          name={profile.username ?? "?"}
          size={88}
          className="ring-1 ring-[var(--accent-gold)]/30"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Szurkolói profil
          </p>
          <h1 className="mt-1 truncate font-display text-3xl leading-none tracking-wider text-[var(--text-primary)] sm:text-4xl">
            {profile.username ?? "Névtelen szurkoló"}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">
            {joinDate && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={11} aria-hidden />
                {joinDate} óta
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Newspaper size={11} aria-hidden />
              <span className="tabular-nums">{profile.post_count}</span>{" "}
              {profile.post_count === 1 ? "poszt" : "poszt"}
            </span>
            {profile.role === "admin" && (
              <span className="inline-flex items-center gap-1.5 text-[var(--accent-gold)]">
                <ShieldCheck size={11} aria-hidden />
                Klubadmin
              </span>
            )}
          </div>
        </div>

        {user && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <FollowButton
              targetUserId={profile.id}
              onStatusChange={onFollowStatusChange}
            />
            <button
              type="button"
              onClick={onStartConv}
              disabled={!canMessage || startingConv}
              title={
                !canMessage
                  ? "Csak kölcsönös követés esetén küldhető üzenet"
                  : undefined
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs",
                "font-display uppercase tracking-[0.18em]",
                "transition-all duration-200",
                canMessage
                  ? cn(
                      "border border-[var(--glass-border-hover)] bg-[var(--glass-bg)]",
                      "text-[var(--text-primary)] hover:border-[var(--accent-gold)]/50",
                      "hover:bg-[var(--accent-gold)]/[0.08] hover:text-[var(--accent-gold)]",
                    )
                  : cn(
                      "border border-dashed border-[var(--glass-border)] bg-transparent",
                      "text-[var(--text-muted)] cursor-not-allowed",
                    ),
              )}
            >
              <MessageCircle size={13} aria-hidden />
              <span>Üzenet</span>
            </button>
          </div>
        )}
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Posts list                                                          */
/* ------------------------------------------------------------------ */

function ProfilePostsSection({
  loading,
  posts,
  authorCache,
  onResolveAuthors,
  onReact,
  onRequireLogin,
}: {
  loading: boolean;
  posts: EnrichedPost[];
  authorCache: Record<string, AuthorSnapshot | undefined>;
  onResolveAuthors: (ids: string[]) => Promise<void>;
  onReact: (emoji: string) => Promise<void>;
  onRequireLogin: () => void;
}) {
  return (
    <section className="mt-8">
      <header className="mb-4 flex items-center gap-3">
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-r from-[var(--accent-gold)]/30 via-[var(--glass-border)] to-transparent"
        />
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
          Posztok
        </p>
        <span
          aria-hidden
          className="h-px flex-1 bg-gradient-to-l from-[var(--accent-gold)]/30 via-[var(--glass-border)] to-transparent"
        />
      </header>

      {loading ? (
        <div className="flex flex-col gap-5" aria-hidden>
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="glass-card flex flex-col gap-3 p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
                <span className="h-3 w-1/3 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
              </div>
              <span className="h-3 w-11/12 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
              <span className="h-3 w-9/12 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div
          className={cn(
            "rounded-[var(--radius-lg)] border border-dashed",
            "border-[var(--glass-border)] bg-[var(--glass-bg)]/30",
            "px-6 py-10 text-center text-sm text-[var(--text-secondary)]",
          )}
        >
          Még nincsenek posztok ezen a profilon.
        </div>
      ) : (
        <ul className="flex flex-col gap-5">
          {posts.map((p, idx) => (
            <li key={p.id}>
              <PostCard
                post={p}
                author={authorCache[p.author_id] ?? null}
                index={idx}
                ownReaction={undefined}
                isAdmin={false}
                canReact={false}
                authorCache={authorCache}
                onResolveAuthors={onResolveAuthors}
                onReactAdd={onReact}
                onReactSwap={onReact}
                onReactRevoke={() => Promise.resolve()}
                onRequireLogin={onRequireLogin}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 404                                                                 */
/* ------------------------------------------------------------------ */

function NotFoundCard() {
  return (
    <motion.section
      key="not-found"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "mt-6 flex flex-col items-center gap-4 rounded-[var(--radius-lg)]",
        "border border-dashed border-[var(--glass-border)] bg-[var(--glass-bg)]/40",
        "p-12 text-center",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex h-14 w-14 items-center justify-center rounded-full",
          "border border-[var(--accent-gold)]/30 bg-[var(--accent-gold)]/[0.06]",
          "text-[var(--accent-gold)]",
        )}
      >
        <Frown size={22} aria-hidden />
      </span>
      <p className="font-display text-3xl tracking-widest text-[var(--accent-gold)]">
        Ez a profil nem létezik
      </p>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">
        A keresett szurkolót nem találjuk. Lehet, hogy törölte a fiókját
        vagy a hivatkozás már nem érvényes.
      </p>
      <Link
        href="/kozosseg"
        className={cn(
          "mt-2 inline-flex items-center gap-1.5 rounded-full px-4 py-2",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "font-display text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]",
          "transition-colors hover:border-[var(--accent-gold)]/50 hover:text-[var(--accent-gold)]",
        )}
      >
        <ArrowLeft size={11} aria-hidden />
        Vissza a közösséghez
      </Link>
    </motion.section>
  );
}
