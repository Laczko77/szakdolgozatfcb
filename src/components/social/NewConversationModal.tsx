"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Loader2,
  MessageCircle,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { useToast } from "@/providers/ToastProvider";
import {
  ApiError,
  fetchFollowStatus,
  followUser,
  searchUsers,
  startConversation,
} from "@/lib/dm-api";
import type { FollowStatusKind, UserSearchResult } from "@/types/dm";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

/**
 * "Új üzenet" modal — F26.7 rewrite.
 *
 * The backend now returns the full set of matching users (not just
 * mutual follows) and may inline a `follow_status` field per row. We
 * render a state-aware row:
 *
 *   · `not_following` → "Követés kérése" button (POST /follow). On
 *     success the row flips to `pending` in place; the user can keep
 *     searching or close the modal.
 *   · `pending` → disabled "Kérelem elküldve" pill.
 *   · `following` → "Üzenet" button. Click opens (or creates) the
 *     conversation via POST /api/conversations and dismisses the modal.
 *
 * Mutual follow is no longer required to *start* the conversation —
 * the new flow only asks for the target's `follow_status === following`.
 * This matches the backend's new approval-based pairing model.
 *
 * Keyboard: Escape closes; the search input is auto-focused on open.
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
  /** id of the row currently in-flight for either follow OR start-conv. */
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reset state on open. Wrapped in a microtask so the React 19
  // set-state-in-effect lint stays quiet — these are pure state resets
  // tied to a UI lifecycle event, not a "cascading render".
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setQuery("");
      setResults([]);
      setSearching(false);
      setBusyId(null);
    });
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
      queueMicrotask(() => {
        setResults([]);
        setSearching(false);
      });
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

          // Hydrate follow_status for any row missing it. Most backends
          // ship it inline; this loop is defensive.
          for (const u of users) {
            if (u.follow_status) continue;
            void (async () => {
              try {
                const status = await fetchFollowStatus(u.id, c.signal);
                if (c.signal.aborted) return;
                setResults((prev) =>
                  prev.map((r) =>
                    r.id === u.id
                      ? { ...r, follow_status: status.status }
                      : r,
                  ),
                );
              } catch {
                /* status stays unknown → row treated as not_following */
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

  const updateRowStatus = useCallback(
    (userId: string, next: FollowStatusKind) => {
      setResults((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, follow_status: next } : r)),
      );
    },
    [],
  );

  const handleFollow = useCallback(
    async (user: UserSearchResult) => {
      if (busyId) return;
      setBusyId(user.id);
      // Optimistic flip → pending.
      updateRowStatus(user.id, "pending");
      try {
        await followUser(user.id);
        toast.success("Követési kérelem elküldve");
      } catch (err) {
        // Rollback.
        updateRowStatus(user.id, "not_following");
        if (err instanceof ApiError && err.status === 409) {
          toast.info("A kérelem már elküldve");
        } else {
          toast.error(
            err instanceof Error ? err.message : "Kérelem küldése sikertelen",
          );
        }
      } finally {
        setBusyId(null);
      }
    },
    [busyId, updateRowStatus, toast],
  );

  const handleMessage = useCallback(
    async (user: UserSearchResult) => {
      if (busyId) return;
      setBusyId(user.id);
      try {
        const conv = await startConversation(user.id);
        onSelect(conv.id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          toast.info("Még nem követitek egymást");
        } else {
          toast.error(
            err instanceof Error
              ? err.message
              : "Beszélgetés indítása sikertelen",
          );
        }
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onSelect, toast],
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
            className="glass-modal-backdrop absolute inset-0"
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
              "glass-modal relative w-full max-w-md overflow-hidden",
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
                          busy={busyId === u.id}
                          onFollow={() => void handleFollow(u)}
                          onMessage={() => void handleMessage(u)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <p className="border-t border-[var(--glass-border)] px-5 py-3 text-[11px] text-[var(--text-muted)] sm:px-7">
              Beszélgetést csak akkor tudsz indítani, ha a másik fél
              elfogadta a követési kérelmedet.
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
  busy,
  onFollow,
  onMessage,
}: {
  user: UserSearchResult;
  busy: boolean;
  onFollow: () => void;
  onMessage: () => void;
}) {
  const status: FollowStatusKind = user.follow_status ?? "not_following";
  const isFollowing = status === "following";
  const isPending = status === "pending";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5",
        "border border-transparent transition-all",
        isFollowing
          ? "hover:border-[var(--accent-gold)]/40 hover:bg-[var(--accent-gold)]/[0.05]"
          : "hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
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
          {isFollowing ? (
            <span className="text-[var(--accent-gold)]">Követed</span>
          ) : isPending ? (
            <>
              <Clock size={10} aria-hidden />
              <span>Kérelem elküldve</span>
            </>
          ) : (
            <span>Még nem követed</span>
          )}
        </p>
      </div>

      {/* CTA */}
      {isFollowing ? (
        <button
          type="button"
          onClick={onMessage}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
            "border border-[var(--accent-gold)]/50 bg-[var(--accent-gold)]/[0.08]",
            "font-display text-[10px] uppercase tracking-[0.18em] text-[var(--accent-gold)]",
            "transition-all duration-200",
            "hover:bg-[var(--accent-gold)]/[0.16] hover:border-[var(--accent-gold)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? (
            <Loader2 size={11} className="animate-spin" aria-hidden />
          ) : (
            <MessageCircle size={11} aria-hidden />
          )}
          <span>Üzenet</span>
        </button>
      ) : isPending ? (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
            "border border-[var(--glass-border)] bg-[var(--glass-bg)]/60",
            "font-display text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]",
            "cursor-not-allowed",
          )}
        >
          <Clock size={11} aria-hidden />
          <span>Elküldve</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={onFollow}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5",
            "border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/[0.04]",
            "font-display text-[10px] uppercase tracking-[0.18em] text-[var(--accent-gold)]",
            "transition-all duration-200",
            "hover:bg-[var(--accent-gold)]/[0.12] hover:border-[var(--accent-gold)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy ? (
            <Loader2 size={11} className="animate-spin" aria-hidden />
          ) : (
            <UserPlus size={11} aria-hidden />
          )}
          <span>Követés kérése</span>
        </button>
      )}
    </div>
  );
}
