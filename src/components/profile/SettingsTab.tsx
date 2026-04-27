"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Save, ShieldAlert } from "lucide-react";
import type { Profile } from "@/types/database";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { changePassword, updateProfile } from "@/lib/profile-api";
import { GlassField } from "@/components/auth/GlassField";
import { cn } from "@/lib/utils";

/**
 * /profil → Beállítások tab.
 *
 * Two independent forms in stacked glass cards:
 *   1. Becenév módosítás (lightweight — the same mutation lives on the
 *      ProfileHero too; this form is the discoverable, descriptive
 *      version).
 *   2. Jelszóváltoztatás — current + new + confirm. Calls the dedicated
 *      `/api/profile/password` endpoint which re-verifies the current
 *      password before updating.
 */

interface SettingsTabProps {
  profile: Profile;
  onUpdated?: (next: Profile) => void;
}

const USERNAME_MIN = 2;
const USERNAME_MAX = 32;
const PASSWORD_MIN = 8;

export function SettingsTab({ profile, onUpdated }: SettingsTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <UsernameForm profile={profile} onUpdated={onUpdated} />
      <PasswordForm />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Username form
// ---------------------------------------------------------------------------

function UsernameForm({
  profile,
  onUpdated,
}: {
  profile: Profile;
  onUpdated?: (next: Profile) => void;
}) {
  const { refreshProfile } = useAuth();
  const toast = useToast();

  const [value, setValue] = useState(profile.username ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value.trim() !== (profile.username ?? "").trim();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = value.trim();
    if (
      trimmed.length > 0 &&
      (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX)
    ) {
      setError(
        `${USERNAME_MIN}-${USERNAME_MAX} karakter között kell legyen.`,
      );
      return;
    }

    setBusy(true);
    try {
      const next = await updateProfile({
        username: trimmed.length === 0 ? null : trimmed,
      });
      toast.success("Becenév mentve");
      onUpdated?.(next);
      await refreshProfile();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Mentés sikertelen";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Becenév"
      description="Ezzel a névvel jelensz meg a kommentekben és a navigációban."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <GlassField
          label="Becenév"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={USERNAME_MAX}
          error={error}
          hint={`${USERNAME_MIN}-${USERNAME_MAX} karakter — vagy hagyd üresen, ha nem akarsz becenevet.`}
          autoComplete="nickname"
        />

        <div className="flex justify-end">
          <PrimaryButton type="submit" disabled={!dirty || busy} busy={busy}>
            <Save size={14} aria-hidden />
            Mentés
          </PrimaryButton>
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Password form
// ---------------------------------------------------------------------------

function PasswordForm() {
  const toast = useToast();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{
    current?: string;
    next?: string;
    confirm?: string;
    form?: string;
  }>({});

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirmValue("");
    setErrors({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fieldErrors: typeof errors = {};

    if (current.length === 0) {
      fieldErrors.current = "Add meg a jelenlegi jelszavadat.";
    }
    if (next.length < PASSWORD_MIN) {
      fieldErrors.next = `Legalább ${PASSWORD_MIN} karakter szükséges.`;
    }
    if (confirmValue !== next) {
      fieldErrors.confirm = "A két jelszó nem egyezik.";
    }

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setBusy(true);
    try {
      await changePassword({
        currentPassword: current,
        newPassword: next,
      });
      toast.success("Jelszó frissítve");
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Hiba történt";
      // Surface 401 from the backend on the current-password field for clarity.
      if (/jelenlegi jelszó/i.test(msg)) {
        setErrors({ current: msg });
      } else {
        setErrors({ form: msg });
      }
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Jelszó módosítása"
      description="Erős jelszót válassz — a Forca Barça fiókod biztonsága a tét."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <GlassField
          label="Jelenlegi jelszó"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          error={errors.current ?? null}
          autoComplete="current-password"
        />
        <GlassField
          label="Új jelszó"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={errors.next ?? null}
          hint={`Minimum ${PASSWORD_MIN} karakter.`}
          autoComplete="new-password"
        />
        <GlassField
          label="Új jelszó újra"
          type="password"
          value={confirmValue}
          onChange={(e) => setConfirmValue(e.target.value)}
          error={errors.confirm ?? null}
          autoComplete="new-password"
        />

        {errors.form && (
          <div
            role="alert"
            className={cn(
              "flex items-start gap-2 rounded-md px-3 py-2",
              "border border-[var(--accent-red)]/40 bg-[var(--accent-red-subtle)]",
              "text-xs text-[var(--accent-red)]",
            )}
          >
            <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>{errors.form}</span>
          </div>
        )}

        <div className="flex justify-end">
          <PrimaryButton type="submit" busy={busy}>
            <KeyRound size={14} aria-hidden />
            Jelszó frissítése
          </PrimaryButton>
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "glass-card p-5 sm:p-6",
        "flex flex-col gap-5",
      )}
    >
      <header>
        <h3 className="font-display text-xl tracking-wide text-[var(--text-primary)]">
          {title}
        </h3>
        <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-[13px]">
          {description}
        </p>
      </header>
      {children}
    </motion.section>
  );
}

function PrimaryButton({
  children,
  busy = false,
  disabled,
  type = "button",
  onClick,
}: {
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5",
        "font-display text-xs uppercase tracking-[0.18em]",
        "border border-[var(--accent-gold)]",
        "bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)]",
        "hover:bg-[var(--accent-gold)] hover:text-[var(--bg-primary)]",
        "transition-colors duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
      )}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  );
}
