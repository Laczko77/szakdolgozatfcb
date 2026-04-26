"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthUserState {
  user: User | null;
  loading: boolean;
}

/**
 * Subscribes to the Supabase auth session on the browser.
 *
 * - On mount: reads the current user with `getUser()`.
 * - Then keeps the local state in sync via `onAuthStateChange`, so the
 *   navbar avatar swaps live when the user logs in/out from another tab
 *   or after a server-side redirect.
 *
 * The Supabase browser client is memoized internally, so calling
 * `createClient()` from multiple components is safe.
 */
export function useAuthUser(): AuthUserState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return;
        setUser(data.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setUser(null);
        setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
