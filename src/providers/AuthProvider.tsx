"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

/**
 * Shape exposed to consumers via {@link useAuth}.
 *
 * - `user` / `profile` are `null` when nobody is signed in.
 * - `isAdmin` is a derived convenience boolean.
 * - `isLoading` reflects the *initial* hydration only — once the first
 *   `getUser()` resolves it stays `false` for the rest of the lifetime,
 *   even when subsequent auth events fire. Components that need to react
 *   to mid-session changes should use `user`/`session` directly.
 */
interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  /**
   * Force a profile re-fetch — useful after the user updates their profile
   * row from another screen (e.g. settings page).
   */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Single source of truth for the browser's auth state.
 *
 * Wiring:
 *   1. On mount, hydrate user + profile from `supabase.auth.getUser()`.
 *   2. Subscribe to `onAuthStateChange` so login / logout / token refresh
 *      events keep React state in sync (and re-fetch the profile when the
 *      user identity actually changes).
 *   3. Expose `signOut()` that flushes server cookies via the API route
 *      AND tells the browser client — both are needed because middleware
 *      reads cookies, but the in-memory client also caches the session.
 *
 * The `profiles` row is fetched separately (not from auth metadata) so we
 * always reflect the canonical role / username / avatar from the DB.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track the last user id we fetched a profile for — avoids redundant
  // queries when token-refresh events fire without an identity change.
  const fetchedForUserId = useRef<string | null>(null);

  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        // Profile row may legitimately not exist yet right after sign-up
        // (the DB trigger fires after the redirect resolves). Surface as
        // null rather than throwing — the UI handles missing profiles.
        return null;
      }
      return data as Profile;
    },
    [supabase],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const next = await fetchProfile(user.id);
    setProfile(next);
  }, [user, fetchProfile]);

  // ── Initial hydration ────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      const {
        data: { session: s },
      } = await supabase.auth.getSession();

      if (!active) return;

      setUser(u);
      setSession(s);

      if (u) {
        const p = await fetchProfile(u.id);
        if (!active) return;
        setProfile(p);
        fetchedForUserId.current = u.id;
      }

      setIsLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [supabase, fetchProfile]);

  // ── Live subscription to auth events ─────────────────────────────────
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);

      // Only refetch the profile when the user identity actually changes
      // (sign-in / sign-out / user-id rotation). Token refreshes keep the
      // same id and don't need to thrash the network.
      if (nextUser?.id !== fetchedForUserId.current) {
        if (nextUser) {
          fetchProfile(nextUser.id).then((p) => {
            setProfile(p);
            fetchedForUserId.current = nextUser.id;
          });
        } else {
          setProfile(null);
          fetchedForUserId.current = null;
        }
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    fetchedForUserId.current = null;
    // Hard refresh of server-rendered data so any cookie-bound RSC reflects
    // the signed-out state immediately.
    router.refresh();
    router.push("/");
  }, [supabase, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isAdmin: profile?.role === "admin",
      isLoading,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, isLoading, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Read the current auth state from anywhere in the client tree.
 * Throws if rendered outside `<AuthProvider />` so misuse is loud.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider />");
  }
  return ctx;
}
