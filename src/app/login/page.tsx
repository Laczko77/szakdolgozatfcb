"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useToast } from "@/providers/ToastProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { GlassField } from "@/components/auth/GlassField";
import { PrimaryAuthButton } from "@/components/auth/PrimaryAuthButton";
import { GoogleButton } from "@/components/auth/GoogleButton";

/**
 * /login — Email + password sign-in with Google OAuth fallback.
 *
 * Behaviour:
 *   - Already-authenticated visitors are bounced to the dashboard (or
 *     ?returnUrl=/?redirect= if present), so the page never flashes the
 *     form for signed-in users.
 *   - Email + password form runs Supabase's `signInWithPassword`; errors
 *     are mapped to Hungarian copy (no raw Supabase strings leak).
 *   - Google OAuth uses the implicit redirect flow back to /auth/callback
 *     — the Supabase client handles the rest.
 *
 * Next.js requires useSearchParams() to be wrapped in <Suspense> for
 * static generation. LoginPageInner holds the actual logic; this outer
 * component provides the boundary.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Belépés" subtitle="Betöltés..." footer={null}>
          <div className="flex justify-center py-8">
            <div className="border-glass-border h-8 w-8 animate-spin rounded-full border-2 border-t-[var(--accent-gold)]" />
          </div>
        </AuthShell>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const reduce = useReducedMotion();
  const toast = useToast();
  const { user, isLoading: authLoading } = useAuth();

  // Both ?returnUrl= and ?redirect= are honoured. The middleware uses
  // ?redirect=, the navbar passes ?returnUrl=, and we accept either.
  const returnUrl =
    search.get("returnUrl") ?? search.get("redirect") ?? "/dashboard";

  // ?error=email_exists comes from the /auth/callback route when a Google
  // login collides with an existing email+password account.
  const urlError = search.get("error");
  const urlErrorEmail = search.get("email");

  const [email, setEmail] = useState(urlErrorEmail ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>(() => {
    if (urlError === "email_exists") {
      return {
        form: `Ezzel az email címmel (${urlErrorEmail ?? ""}) már regisztráltál jelszóval. Jelentkezz be jelszóval — a profilodban később csatolhatod a Google fiókodat.`,
      };
    }
    if (urlError === "auth_failed" || urlError === "oauth_error") {
      return { form: "A Google-bejelentkezés nem sikerült. Próbáld újra." };
    }
    return {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Bounce already-authenticated users away from the login screen.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(safeReturnUrl(returnUrl));
    }
  }, [authLoading, user, returnUrl, router]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Add meg az email címed.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Érvénytelen email cím.";
    if (!password) next.password = "Add meg a jelszavad.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || googleSubmitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrors({ form: mapAuthError(error) });
      setSubmitting(false);
      return;
    }

    toast.success("Sikeres bejelentkezés!");
    // router.refresh() lets server components re-render with the new cookie;
    // router.replace() then navigates to the intended destination.
    router.refresh();
    router.replace(safeReturnUrl(returnUrl));
  }

  async function handleGoogle() {
    if (submitting || googleSubmitting) return;
    setGoogleSubmitting(true);
    setErrors({});

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeReturnUrl(returnUrl))}`,
      },
    });

    if (error) {
      setErrors({ form: mapAuthError(error) });
      setGoogleSubmitting(false);
    }
    // On success: browser is being redirected by Supabase, leave the
    // spinner up so the user sees something is happening.
  }

  // Avoid flashing the form during the initial auth hydration.
  if (authLoading || (!authLoading && user)) {
    return (
      <AuthShell
        title="Belépés"
        subtitle="Egy pillanat..."
        footer={null}
      >
        <div className="flex justify-center py-8">
          <div className="border-glass-border h-8 w-8 animate-spin rounded-full border-2 border-t-[var(--accent-gold)]" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Belépés"
      subtitle={
        <>
          Üdv újra a kék-piros oldalon. <br className="hidden sm:inline" />
          Lépj be, hogy folytasd onnan, ahol abbahagytad.
        </>
      }
      footer={
        <>
          Nincs még fiókod?{" "}
          <Link
            href={`/register${returnUrl !== "/dashboard" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
            className="text-text-primary hover:text-[var(--accent-gold)] font-medium underline-offset-4 transition-colors hover:underline"
          >
            Regisztrálj
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Form-level error banner */}
        {errors.form && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            role="alert"
            className="rounded-md border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {errors.form}
          </motion.div>
        )}

        <FieldRow delay={0.05} reduce={reduce}>
          <GlassField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="te@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
          />
        </FieldRow>

        <FieldRow delay={0.1} reduce={reduce}>
          <GlassField
            label="Jelszó"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />
        </FieldRow>

        {/* Forgot-password — placeholder route, will be wired in F11 */}
        <div className="-mt-2 flex justify-end">
          <Link
            href="/elfelejtett-jelszo"
            className="text-text-secondary hover:text-[var(--accent-gold)] text-xs transition-colors"
          >
            Elfelejtetted a jelszót?
          </Link>
        </div>

        <FieldRow delay={0.15} reduce={reduce}>
          <PrimaryAuthButton type="submit" loading={submitting}>
            Belépés
          </PrimaryAuthButton>
        </FieldRow>

        {/* OR divider */}
        <div
          aria-hidden
          className="my-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[var(--text-muted)]"
        >
          <span className="from-glass-border h-px flex-1 bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent" />
          <span>vagy</span>
          <span className="from-glass-border h-px flex-1 bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent" />
        </div>

        <FieldRow delay={0.2} reduce={reduce}>
          <GoogleButton
            type="button"
            onClick={handleGoogle}
            loading={googleSubmitting}
            label="Belépés Google-lel"
          />
        </FieldRow>
      </form>
    </AuthShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

interface FieldRowProps {
  children: React.ReactNode;
  delay: number;
  reduce: boolean;
}

/**
 * Tiny wrapper that staggers the field reveal. Each row fades + slides
 * up by 4px, so the form materialises in sequence rather than all at once.
 */
function FieldRow({ children, delay, reduce }: FieldRowProps) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Translate a Supabase auth error into Hungarian fan-portal copy.
 * Codes are stable (per @supabase/supabase-js >=2.93), but we also fall
 * back on message inspection for older deployments.
 */
function mapAuthError(error: AuthError): string {
  const msg = error.message?.toLowerCase() ?? "";

  if (
    error.code === "invalid_credentials" ||
    msg.includes("invalid login credentials")
  ) {
    return "Hibás email vagy jelszó.";
  }
  if (error.code === "email_not_confirmed" || msg.includes("not confirmed")) {
    return "Erősítsd meg az email címed mielőtt belépsz.";
  }
  if (error.code === "user_not_found" || msg.includes("user not found")) {
    return "Ezzel az emaillel nincs regisztrált fiók.";
  }
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Túl sok próbálkozás. Várj egy kicsit, és próbáld újra.";
  }
  return "Valami hiba történt. Próbáld újra később.";
}

/**
 * Prevent open-redirect attacks: only allow same-origin paths.
 */
function safeReturnUrl(url: string): string {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) {
    return "/dashboard";
  }
  return url;
}
