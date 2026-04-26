"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { LoadingScreen } from "@/components/common/LoadingScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * If true, the route is only available to admin profiles.
   * Non-admin authenticated users get bounced to `/dashboard`.
   */
  adminOnly?: boolean;
  /**
   * Override the default redirect destination ("/login").
   * The current pathname is appended as `?returnUrl=` automatically.
   */
  loginPath?: string;
}

/**
 * Client-side guard for routes that require authentication.
 *
 * The Next.js middleware already protects `/admin/*` server-side, but
 * other authenticated areas (dashboard, profile, settings, points,
 * orders…) need a client-side guard so we can redirect cleanly with the
 * full intended URL preserved.
 *
 * Usage:
 *   export default function DashboardPage() {
 *     return (
 *       <ProtectedRoute>
 *         <DashboardContent />
 *       </ProtectedRoute>
 *     );
 *   }
 *
 * While the auth state is hydrating we render the {@link LoadingScreen}
 * so the protected content never flashes for unauthenticated users.
 */
export function ProtectedRoute({
  children,
  adminOnly = false,
  loginPath = "/login",
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      const target = `${loginPath}?returnUrl=${encodeURIComponent(pathname ?? "/")}`;
      router.replace(target);
      return;
    }

    if (adminOnly && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, isAdmin, adminOnly, pathname, loginPath, router]);

  // While we don't have a verdict yet, OR the user fails the check,
  // show the loading overlay rather than the protected children. The
  // useEffect above will redirect on the next tick.
  if (isLoading || !user || (adminOnly && !isAdmin)) {
    return <LoadingScreen isVisible label="Hitelesítés..." />;
  }

  return <>{children}</>;
}
