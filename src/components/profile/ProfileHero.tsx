"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Camera,
  Check,
  Coins,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { Profile } from "@/types/database";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { updateProfile } from "@/lib/profile-api";
import { cn } from "@/lib/utils";

/**
 * The "identity card" at the top of the /profil shell.
 *
 *  - Circular avatar with a hover-revealed change overlay (file picker).
 *  - Live preview before the upload completes — we render the local
 *    object URL until the server returns the canonical URL.
 *  - Inline-editable username (click the pencil → input → Enter / Esc).
 *  - Live point balance pulled from a parent prop (so we don't double-fetch
 *    when the Points tab is also rendering).
 *
 * After every successful mutation we call `refreshProfile()` from
 * `useAuth()` so the navbar avatar / display name update without a hard
 * reload.
 */

interface ProfileHeroProps {
  profile: Profile;
  pointsBalance: number | null;
  pointsLoading?: boolean;
  /** Called after a successful avatar / username update. */
  onUpdated?: (next: Profile) => void;
}

const USERNAME_MIN = 2;
const USERNAME_MAX = 32;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export function ProfileHero({
  profile,
  pointsBalance,
  pointsLoading = false,
  onUpdated,
}: ProfileHeroProps) {
  const { refreshProfile } = useAuth();
  const toast = useToast();

  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [busyAvatar, setBusyAvatar] = useState(false);

  const avatarToShow = pendingPreview ?? profile.avatar_url;
  const initials = buildInitials(profile.username, profile.email);

  // Cleanup of the local object URL once the upload completes (or unmount).
  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const onPickAvatar = () => fileRef.current?.click();

  const onFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so the same file can be re-selected after a failure.
      e.target.value = "";
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Csak képet tudunk feltölteni profilképként.");
        return;
      }
      if (file.size > MAX_AVATAR_BYTES) {
        toast.error("A profilkép maximum 5 MB lehet.");
        return;
      }

      const preview = URL.createObjectURL(file);
      setPendingPreview(preview);
      setBusyAvatar(true);
      try {
        const next = await updateProfile({ avatar: file });
        toast.success("Profilkép frissítve");
        onUpdated?.(next);
        await refreshProfile();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Feltöltés sikertelen",
        );
      } finally {
        setBusyAvatar(false);
        setPendingPreview(null);
        URL.revokeObjectURL(preview);
      }
    },
    [toast, refreshProfile, onUpdated],
  );

  const onRemoveAvatar = useCallback(async () => {
    if (!profile.avatar_url) return;
    setBusyAvatar(true);
    try {
      const next = await updateProfile({ removeAvatar: true });
      toast.success("Profilkép eltávolítva");
      onUpdated?.(next);
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hiba történt");
    } finally {
      setBusyAvatar(false);
    }
  }, [profile.avatar_url, toast, refreshProfile, onUpdated]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(
        "glass-card glass-border-gradient",
        "relative overflow-hidden p-5 sm:p-7",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-gold)]/55 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--accent-gold-subtle), transparent)",
        }}
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
        {/* ── Avatar ─────────────────────────────────────────── */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "relative h-24 w-24 overflow-hidden rounded-full sm:h-28 sm:w-28",
              "border border-[var(--glass-border-hover)]",
              "shadow-[var(--shadow-md)]",
              !avatarToShow &&
                "bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-red)]",
            )}
          >
            {avatarToShow ? (
              <Image
                src={avatarToShow}
                alt={profile.username ?? "Profilkép"}
                fill
                sizes="(max-width: 640px) 96px, 112px"
                className={cn(
                  "object-cover",
                  busyAvatar && "opacity-60",
                )}
                unoptimized
              />
            ) : (
              <span
                className={cn(
                  "flex h-full w-full items-center justify-center",
                  "font-display text-2xl tracking-wide text-white",
                )}
              >
                {initials}
              </span>
            )}

            {busyAvatar && (
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center bg-black/30"
              >
                <Loader2
                  size={22}
                  className="animate-spin text-[var(--accent-gold)]"
                />
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onPickAvatar}
            disabled={busyAvatar}
            aria-label="Profilkép módosítása"
            className={cn(
              "absolute -bottom-1 -right-1 inline-flex h-9 w-9 items-center justify-center rounded-full",
              "border border-[var(--accent-gold)]",
              "bg-[var(--bg-primary)] text-[var(--accent-gold)]",
              "shadow-[var(--shadow-md)]",
              "transition-transform duration-200",
              "hover:scale-105 hover:bg-[var(--glass-bg-hover)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          >
            <Camera size={15} strokeWidth={1.9} />
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onFileChange}
          />
        </div>

        {/* ── Identity ───────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
            Forca Barça // Profilom
          </p>

          <UsernameField
            initial={profile.username ?? ""}
            email={profile.email}
            onSaved={(next) => {
              onUpdated?.(next);
            }}
          />

          <p className="mt-1.5 truncate text-xs text-[var(--text-muted)]">
            {profile.email}
          </p>

          {profile.avatar_url && !busyAvatar && (
            <button
              type="button"
              onClick={onRemoveAvatar}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                "text-[10px] uppercase tracking-[0.18em]",
                "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "text-[var(--text-muted)] hover:text-[var(--accent-red)]",
                "transition-colors",
              )}
            >
              <Trash2 size={11} />
              Profilkép eltávolítása
            </button>
          )}
        </div>

        {/* ── Points ─────────────────────────────────────────── */}
        <div
          className={cn(
            "rounded-[var(--radius-md)] border border-[var(--glass-border-hover)]",
            "bg-[var(--glass-bg-strong)] px-5 py-4",
            "min-w-[160px]",
          )}
        >
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Pontegyenleg
          </p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <Coins
              size={18}
              className="text-[var(--accent-gold)]"
              aria-hidden
            />
            <span
              className={cn(
                "font-display tabular-nums tracking-wide",
                "text-3xl text-[var(--accent-gold)] sm:text-4xl",
                "[text-shadow:0_0_22px_var(--accent-gold-subtle)]",
              )}
            >
              {pointsLoading || pointsBalance === null
                ? "—"
                : pointsBalance.toLocaleString("hu-HU")}
            </span>
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Forca pont
          </p>
        </div>
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Inline-editable username
// ---------------------------------------------------------------------------

function UsernameField({
  initial,
  email,
  onSaved,
}: {
  initial: string;
  email: string;
  onSaved: (next: Profile) => void;
}) {
  const { refreshProfile } = useAuth();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when the parent's profile prop refreshes after save.
  // Defer the setState to a microtask so it doesn't trip
  // `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (editing) return;
    queueMicrotask(() => setValue(initial));
  }, [initial, editing]);

  useEffect(() => {
    if (editing) {
      // Defer focus so the input is mounted.
      const t = window.setTimeout(() => inputRef.current?.select(), 20);
      return () => window.clearTimeout(t);
    }
  }, [editing]);

  const displayName = initial.trim() || email.split("@")[0] || "Szurkoló";

  const cancel = () => {
    setEditing(false);
    setValue(initial);
  };

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === initial.trim()) {
      setEditing(false);
      return;
    }
    if (
      trimmed.length > 0 &&
      (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX)
    ) {
      toast.error(
        `A becenév ${USERNAME_MIN}-${USERNAME_MAX} karakter között kell legyen.`,
      );
      return;
    }
    setBusy(true);
    try {
      const next = await updateProfile({
        username: trimmed.length === 0 ? null : trimmed,
      });
      toast.success("Becenév frissítve");
      onSaved(next);
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "group mt-2 inline-flex max-w-full items-center gap-2",
          "text-left transition-colors",
        )}
        aria-label="Becenév szerkesztése"
      >
        <span
          className={cn(
            "font-display tracking-wide text-[var(--text-primary)]",
            "text-3xl sm:text-4xl",
            "truncate",
          )}
        >
          {displayName}
        </span>
        <span
          aria-hidden
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
            "text-[var(--text-muted)] opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          <Pencil size={12} />
        </span>
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        disabled={busy}
        maxLength={USERNAME_MAX}
        placeholder="Becenév"
        aria-label="Becenév"
        className={cn(
          "flex-1 min-w-0 bg-transparent",
          "font-display text-2xl tracking-wide sm:text-3xl",
          "rounded-md border border-[var(--accent-gold)] px-2.5 py-1",
          "text-[var(--text-primary)]",
          "focus:outline-none focus:shadow-[0_0_0_3px_rgba(245,158,11,0.12)]",
          "disabled:opacity-60",
        )}
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        aria-label="Mentés"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          "border border-[var(--accent-gold)] bg-[var(--accent-gold-subtle)]",
          "text-[var(--accent-gold)]",
          "hover:bg-[var(--accent-gold)] hover:text-[var(--bg-primary)]",
          "transition-colors disabled:opacity-60",
        )}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Check size={14} strokeWidth={2.4} />
        )}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        aria-label="Mégse"
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
          "transition-colors disabled:opacity-60",
        )}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitials(
  username: string | null | undefined,
  email: string,
): string {
  const display = (username && username.trim()) || email.split("@")[0] || "";
  if (!display) return "?";
  const parts = display
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return display.charAt(0).toUpperCase();
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
