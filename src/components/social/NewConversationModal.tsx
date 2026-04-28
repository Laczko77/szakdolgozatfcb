"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, UserCheck, UserPlus, X } from "lucide-react";
import { useToast } from "@/providers/ToastProvider";
import {
  ApiError,
  fetchFollowStatus,
  searchUsers,
  startConversation,
} from "@/lib/dm-api";
import type { UserSearchResult } from "@/types/dm";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

/**
 * "Új üzenet" modal.
 *
 * Two distinct states:
 *  - `idle`: empty input, hint text in the body.
 *  - `searching` / `results`: we run a debounced GET /api/users/search,
 *    show the results as picker rows with a mutual-follow badge and
 *    a "Beszélgetés indítása" CTA.
 *
 * Picking a result calls POST /api/conversations. The endpoint enforces
 * mutual follow — if the response is `403` we emit a Hungarian toast
 * explaining that, instead of bubbling the raw server error.
 *
 * Keyboard:
 *  - Escape closes the modal.
 *  - The first interactive element (search input) is auto-focused on open.
 */
interface NewConversationModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the conversation id once it's created or returned. */
  onSelect: (conversationId: string) => void;
}

export function NewConversationModal({
  open,
  onClose,
  onSelect,
}: NewConversationModalProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);

  // Reset state on open.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setSearching(false);
    setCreatingFor(null);
    // Defer focus so Framer can mount.
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    const c = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const users = await searchUsers(trimmed, c.signal);
          if (c.signal.aborted) return;
          setResults(users);

          // Hydrate mutual-follow badges in the background. We don't
          // block the picker on this — the badge appears the moment
          // the per-user follow-status round-trip resolves.
          for (const u of users) {
            void (async () => {
              try {
                const status = await fetchFollowStatus(u.id, c.signal);
                if (c.signal.aborted) return;
                setResults((prev) =>
                  prev.map((r) =>
                    r.id === u.id ? { ...r, isMutual: status.isMutual } : r,
                  ),
                );
              } catch {
                /* badge stays unknown */
              }
            })();
          }
        } catch (err) {
          if (c.signal.aborted) return;
          toast.error(
            err instanceof Error ? err.message : "Keresés sikertelen",
          );
        } finally {
          if (!c.signal.aborted) setSearching(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [query, open, toast]);

  const handlePick = useCallback(
    async (user: UserSearchResult) => {
      if (creatingFor) return;
      setCreatingFor(user.id);
      try {
        const conv = await startConversation(user.id);
        onSelect(conv.id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          toast.info(
            "Előbb kövesd egymást, hogy üzenetet küldhess",
          );
        } else {
          toast.error(
            err instanceof Error
              ? err.message
              : "Beszélgetés indítása sikertelen",
          );
        }
      } finally {
        setCreatingFor(null);
      }
    },
    [creatingFor, onSelect, toast],
  );

  const showHint = query.trim().length < 2;
  const showEmpty = !showHint && !searching && results.length === 0;

  const heading = useMemo(
    () => (
      <header className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Új üzenet
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-wide text-[var(--text-primary)]">
            Kit keresel?
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Bezárás"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full",
            "border border-[var(--glass-border)] text-[var(--text-secondary)]",
            "transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
          )}
        >
          <X size={15} aria-hidden />
        </button>
      </header>
    ),
    [onClose],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="new-conv-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-conv-title"
          className="fixed inset-0 z-[80] flex items-start justify-center px-4 py-10 sm:py-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.button
            type="button"
            aria-label="Bezárás"
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              "relative w-full max-w-md overflow-hidden",
              "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
              "bg-[var(--bg-secondary)]/95 backdrop-blur-xl",
              "shadow-[var(--shadow-glass-lg)]",
            )}
          >
            {heading}

            {/* Search input */}
            <div className="px-5 pt-5 sm:px-7">
              <label className="sr-only" htmlFor="user-search-input">
                Felhasználó keresése
              </label>
              <div
                className={cn(
                  "relative flex items-center gap-2 rounded-[var(--radius-md)]",
                  "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                  "px-3 py-2.5",
                  "focus-within:border-[var(--accent-gold)]/50",
                )}
              >
                <Search
                  size={15}
                  className="shrink-0 text-[var(--text-muted)]"
                  aria-hidden
                />
                <input
                  id="user-search-input"
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Felhasználónév…"
                  autoComplete="off"
                  className={cn(
                    "flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none",
                    "placeholder:text-[var(--text-muted)]",
                  )}
                />
                {searching && (
                  <Loader2
                    size={14}
                    className="shrink-0 animate-spin text-[var(--text-muted)]"
                    aria-hidden
                  />
                )}
              </div>
            </div>

            {/* Body */}
            <div className="px-2 pb-2 pt-4 sm:px-4">
              <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-3">
                {showHint && (
                  <p className="px-2 py-6 text-center text-sm text-[var(--text-secondary)]">
                    Írj legalább 2 karaktert a kereséshez.
                  </p>
                )}

                {showEmpty && (
                  <p className="px-2 py-6 text-center text-sm text-[var(--text-secondary)]">
                    Nincs ilyen felhasználó.
                  </p>
                )}

                {!showHint && results.length > 0 && (
                  <ul className="space-y-1.5 py-1">
                    {results.map((u) => (
                      <li key={u.id}>
                        <UserRow
                          user={u}
                          submitting={creatingFor === u.id}
                          onSelect={() => void handlePick(u)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <p className="border-t border-[var(--glass-border)] px-5 py-3 text-[11px] text-[var(--text-muted)] sm:px-7">
              Beszélgetést csak <span className="text-[var(--accent-gold)]">kölcsönös követés</span> esetén tudsz indítani.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                */
/* ------------------------------------------------------------------ */

function UserRow({
  user,
  submitting,
  onSelect,
}: {
  user: UserSearchResult;
  submitting: boolean;
  onSelect: () => void;
}) {
  const isMutual = user.isMutual === true;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={submitting}
      className={cn(
        "group flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5",
        "border border-transparent text-left transition-all",
        "hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline-none focus-visible:border-[var(--accent-gold)]/50",
      )}
    >
      <Avatar
        url={user.avatar_url}
        name={user.username ?? "?"}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {user.username ?? "Névtelen szurkoló"}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {user.isMutual === undefined ? (
            <span>Státusz ellenőrzése…</span>
          ) : isMutual ? (
            <>
              <UserCheck
                size={10}
                className="text-[var(--accent-gold)]"
                aria-hidden
              />
              <span className="text-[var(--accent-gold)]">
                Kölcsönös követés
              </span>
            </>
          ) : (
            <>
              <UserPlus size={10} aria-hidden />
              <span>Még nem követitek egymást</span>
            </>
          )}
        </p>
      </div>
      {submitting ? (
        <Loader2 size={14} className="animate-spin text-[var(--text-muted)]" aria-hidden />
      ) : (
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 font-display text-[10px] uppercase tracking-[0.18em]",
            isMutual
              ? "border-[var(--accent-gold)]/50 text-[var(--accent-gold)] group-hover:bg-[var(--accent-gold)]/[0.08]"
              : "border-[var(--glass-border)] text-[var(--text-muted)]",
          )}
        >
          Indítás
        </span>
      )}
    </button>
  );
}
