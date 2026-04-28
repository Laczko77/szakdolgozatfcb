"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";
import type { Profile } from "@/types/database";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { ApiError, startConversation } from "@/lib/dm-api";
import { Avatar } from "@/components/social/Avatar";
import { FollowButton } from "@/components/social/FollowButton";
import type { FollowStatus } from "@/types/dm";
import { cn } from "@/lib/utils";

/**
 * /profil/[id] — public-facing profile of another user.
 *
 * Scope: this is a *minimal* surface introduced in F23 for the explicit
 * purpose of housing the FollowButton + DM CTA. It is intentionally not
 * a full F10-style tabbed shell — the caller's own profile is at
 * /profil and remains the canonical "me" view.
 *
 * Behaviour:
 *   - If `id` matches the caller, we redirect to /profil so users don't
 *     end up on a stripped-down view of themselves.
 *   - The page hydrates the target's public profile row directly via
 *     supabase-js (RLS allows public SELECT on profiles in this app).
 *   - The "Üzenet" button only enables once the FollowButton reports
 *     mutual-follow status — the API enforces the same rule, but
 *     surfacing it client-side avoids a wasted round-trip + toast.
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

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followStatus, setFollowStatus] = useState<FollowStatus | null>(null);
  const [startingConv, setStartingConv] = useState(false);

  // Redirect self → canonical /profil page.
  useEffect(() => {
    if (user && user.id === userId) {
      router.replace("/profil");
    }
  }, [user, userId, router]);

  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (c.signal.aborted) return;
        if (error) throw new Error(error.message);
        setProfile((data as Profile | null) ?? null);
      } catch (err) {
        if (c.signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Profil betöltése sikertelen",
        );
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [supabase, userId, toast]);

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
        toast.info("Előbb kövesd egymást, hogy üzenetet küldhess");
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

      {loading ? (
        <div
          aria-hidden
          className={cn(
            "mt-6 h-44 animate-pulse rounded-[var(--radius-lg)]",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          )}
        />
      ) : !profile ? (
        <section
          className={cn(
            "mt-6 flex flex-col items-center gap-3 rounded-[var(--radius-lg)]",
            "border border-dashed border-[var(--glass-border)] bg-[var(--glass-bg)]/40",
            "p-10 text-center",
          )}
        >
          <p className="font-display text-3xl tracking-widest text-[var(--accent-gold)]">
            Nincs ilyen profil
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            A keresett szurkoló nem található. Lehet, hogy törölte fiókját.
          </p>
        </section>
      ) : (
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
            />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
                Szurkolói profil
              </p>
              <h1 className="mt-1 truncate font-display text-3xl leading-none tracking-wider text-[var(--text-primary)] sm:text-4xl">
                {profile.username ?? "Névtelen szurkoló"}
              </h1>
              {profile.role === "admin" && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--accent-gold)]">
                  <ShieldCheck size={11} aria-hidden />
                  Klubadmin
                </p>
              )}
            </div>

            {user && (
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <FollowButton
                  targetUserId={userId}
                  onStatusChange={setFollowStatus}
                />
                <button
                  type="button"
                  onClick={() => void handleStartConv()}
                  disabled={
                    !followStatus?.isMutual ||
                    startingConv
                  }
                  title={
                    !followStatus?.isMutual
                      ? "Csak kölcsönös követés esetén küldhető üzenet"
                      : undefined
                  }
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs",
                    "font-display uppercase tracking-[0.18em]",
                    "transition-all duration-200",
                    followStatus?.isMutual
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
      )}
    </div>
  );
}
