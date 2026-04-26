"use client";

import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/providers/AuthProvider";

interface AuthUserState {
  user: User | null;
  loading: boolean;
}

/**
 * Backward-compatible thin wrapper around the new {@link useAuth} hook.
 *
 * The single source of truth is now `<AuthProvider />` (mounted in the
 * root layout); this hook just exposes the user/loading slice for
 * legacy callers that don't yet need profile/admin information.
 *
 * Prefer `useAuth()` directly in new code — it gives you the profile,
 * admin flag, and `signOut()` in addition to user/loading.
 */
export function useAuthUser(): AuthUserState {
  const { user, isLoading } = useAuth();
  return { user, loading: isLoading };
}
