"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, MailCheck } from "lucide-react";
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
 * /register — Email + password sign-up.
 *
 * After the Supabase signUp call:
 *   - If a confirmation email is required (default Supabase project
 *     setting), the page swaps to a "check your inbox" success state.
 *   - If auto-confirm is enabled (no email step), the user has a session
 *     immediately and we redirect to /dashboard.
 *
 * Next.js requires useSearchParams() to be wrapped in <Suspense> for
 * static generation. RegisterPageInner holds the actual logic.
 */
export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Regisztráció" subtitle="Betöltés..." footer={null}>
          <div className="flex justify-center py-8">
            <div className="border-glass-border h-8 w-8 animate-spin rounded-full border-2 border-t-[var(--accent-gold)]" />
          </div>
        </AuthShell>
      }
    >
      <RegisterPageInner />
    </Suspense>
  );
}

function RegisterPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const reduce = useReducedMotion();
  const toast = useToast();
  const { user, isLoading: authLoading } = useAuth();

  const returnUrl =
    search.get("returnUrl") ?? search.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // If they're already in, no need to register.
  useEffect(() => {
    if (!authLoading && user && !emailSent) {
      router.replace(safeReturnUrl(returnUrl));
    }
  }, [authLoading, user, returnUrl, router, emailSent]);

  function validate(): boolean {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Add meg az email címed.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Érvénytelen email cím.";

    if (!password) next.password = "Adj meg egy jelszót.";
    else if (password.length < 8)
      next.password = "A jelszó legyen legalább 8 karakter.";

    if (!confirmPassword)
      next.confirmPassword = "Erősítsd meg a jelszót.";
    else if (password !== confirmPassword)
      next.confirmPassword = "A két jelszó nem egyezik.";

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
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeReturnUrl(returnUrl))}`,
      },
    });

    if (error) {
      setErrors({ form: mapAuthError(error) });
      setSubmitting(false);
      return;
    }

    // Two outcomes:
    //   1. Email confirmation required → no session, show inbox screen.
    //   2. Auto-confirm enabled → session present, jump to dashboard.
    if (data.session) {
      toast.success("Sikeres regisztráció!");
      router.refresh();
      router.replace(safeReturnUrl(returnUrl));
      return;
    }

    setEmailSent(true);
    setSubmitting(false);
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
  }

  // ── Email-sent confirmation screen ────────────────────────────────
  if (emailSent) {
    return (
      <AuthShell
        title="Ellenőrizd a postaládádat"
        subtitle={
          <>
            Küldtünk egy megerősítő emailt ide: <br />
            <span className="text-[var(--accent-gold)] font-medium">{email}</span>
          </>
        }
        footer={
          <Link
            href="/login"
            className="hover:text-[var(--accent-gold)] transition-colors"
          >
            ← Vissza a bejelentkezéshez
          </Link>
        }
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-4 py-4"
        >
          <div
            className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-gold)]/10 ring-1 ring-[var(--accent-gold)]/40"
            aria-hidden
          >
            <MailCheck size={28} className="text-[var(--accent-gold)]" />
            <span
              aria-hidden
              className="cta-pulse absolute inset-0 rounded-full"
            />
          </div>
          <ul className="text-text-secondary space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-[var(--accent-gold)]"
              />
              Nyisd meg a kapott emailt
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-[var(--accent-gold)]"
              />
              Kattints a &bdquo;Megerősítés&rdquo; linkre
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2
                size={16}
                className="mt-0.5 shrink-0 text-[var(--accent-gold)]"
              />
              Visszairányítunk a Barça oldalra
            </li>
          </ul>
          <p className="text-text-muted mt-3 text-center text-xs">
            Nem érkezett meg? Nézd meg a spam mappát, vagy próbáld meg
            újraküldeni pár perc múlva.
          </p>
        </motion.div>
      </AuthShell>
    );
  }

  // ── Initial loading guard ─────────────────────────────────────────
  if (authLoading || (!authLoading && user)) {
    return (
      <AuthShell title="Regisztráció" subtitle="Egy pillanat..." footer={null}>
        <div className="flex justify-center py-8">
          <div className="border-glass-border h-8 w-8 animate-spin rounded-full border-2 border-t-[var(--accent-gold)]" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Csatlakozás"
      subtitle={
        <>
          Hozz létre egy fiókot és lépj be a magyar Barça-közösségbe.
          <br className="hidden sm:inline" />
          Hírek, mérkőzések, jegyek — egy helyen.
        </>
      }
      footer={
        <>
          Van már fiókod?{" "}
          <Link
            href={`/login${returnUrl !== "/dashboard" ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ""}`}
            className="text-text-primary hover:text-[var(--accent-gold)] font-medium underline-offset-4 transition-colors hover:underline"
          >
            Jelentkezz be
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
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
            autoComplete="new-password"
            placeholder="Min. 8 karakter"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint={
              !errors.password && password.length === 0
                ? "Legalább 8 karakter ajánlott."
                : undefined
            }
            required
          />
          <PasswordStrengthMeter password={password} reduce={reduce} />
        </FieldRow>

        <FieldRow delay={0.15} reduce={reduce}>
          <GlassField
            label="Jelszó megerősítése"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={errors.confirmPassword}
            required
          />
        </FieldRow>

        <FieldRow delay={0.2} reduce={reduce}>
          <PrimaryAuthButton type="submit" loading={submitting}>
            Regisztráció
          </PrimaryAuthButton>
        </FieldRow>

        <div
          aria-hidden
          className="my-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-[var(--text-muted)]"
        >
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent" />
          <span>vagy</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent" />
        </div>

        <FieldRow delay={0.25} reduce={reduce}>
          <GoogleButton
            type="button"
            onClick={handleGoogle}
            loading={googleSubmitting}
            label="Regisztráció Google-lel"
          />
        </FieldRow>

        <p className="text-text-muted pt-2 text-center text-[11px] leading-relaxed">
          A regisztrációval elfogadod az{" "}
          <Link
            href="/aszf"
            className="text-text-secondary hover:text-[var(--accent-gold)] underline underline-offset-4 transition-colors"
          >
            Általános Szerződési Feltételeket
          </Link>{" "}
          és az{" "}
          <Link
            href="/adatvedelem"
            className="text-text-secondary hover:text-[var(--accent-gold)] underline underline-offset-4 transition-colors"
          >
            Adatvédelmi Tájékoztatót
          </Link>
          .
        </p>
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

// ─────────────────────────────────────────────────────────────────────
// Password strength meter
// ─────────────────────────────────────────────────────────────────────

type StrengthScore = 0 | 1 | 2 | 3 | 4;

function getStrength(pw: string): StrengthScore {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, score) as StrengthScore;
}

const STRENGTH_LABELS: Record<Exclude<StrengthScore, 0>, string> = {
  1: "Gyenge",
  2: "Mérsékelt",
  3: "Erős",
  4: "Nagyon erős",
};

const STRENGTH_COLORS: Record<Exclude<StrengthScore, 0>, string> = {
  1: "var(--accent-red)",
  2: "#f59e0b",
  3: "#10b981",
  4: "#06b6d4",
};

interface PasswordStrengthMeterProps {
  password: string;
  reduce: boolean;
}

function PasswordStrengthMeter({
  password,
  reduce,
}: PasswordStrengthMeterProps) {
  const score = getStrength(password);
  if (score === 0) return null;

  const color = STRENGTH_COLORS[score];
  const label = STRENGTH_LABELS[score];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role="status"
      aria-live="polite"
      aria-label="Jelszó erőssége"
      className="mt-2 space-y-1.5"
    >
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((bar) => {
          const active = bar <= score;
          return (
            <span
              key={bar}
              className="h-1 flex-1 rounded-full transition-[background-color,box-shadow] duration-300 ease-out"
              style={{
                backgroundColor: active ? color : "var(--glass-border)",
                boxShadow: active ? `0 0 8px ${color}33` : "none",
              }}
            />
          );
        })}
      </div>
      <p
        className="text-[11.5px] font-medium uppercase tracking-[0.14em]"
        style={{ color }}
      >
        <span className="sr-only">Jelszó erőssége: </span>
        {label}
      </p>
    </motion.div>
  );
}

function mapAuthError(error: AuthError): string {
  const msg = error.message?.toLowerCase() ?? "";

  if (
    error.code === "user_already_exists" ||
    msg.includes("already registered") ||
    msg.includes("already exists")
  ) {
    return "Ezzel az emaillel már létezik fiók. Próbálj bejelentkezni.";
  }
  if (error.code === "weak_password" || msg.includes("password")) {
    return "A jelszó túl gyenge. Válassz hosszabbat vagy bonyolultabbat.";
  }
  if (msg.includes("rate") || msg.includes("too many")) {
    return "Túl sok próbálkozás. Várj egy kicsit, és próbáld újra.";
  }
  return "Valami hiba történt a regisztráció során. Próbáld újra később.";
}

function safeReturnUrl(url: string): string {
  if (typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) {
    return "/dashboard";
  }
  return url;
}
