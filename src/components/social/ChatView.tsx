"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Message } from "@/types/database";
import type { FollowStatus, ProfileSnapshotWithFollow } from "@/types/dm";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import {
  fetchMessages,
  markConversationRead,
  sendMessage,
} from "@/lib/dm-api";
import { subscribeToConversation } from "@/lib/supabase/realtime";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { cn } from "@/lib/utils";

const MAX_LEN = 2000;

/**
 * Active DM thread.
 *
 * Behaviour:
 *  - On mount we GET the conversation's last 50 messages (oldest → newest)
 *    and auto-scroll to the bottom.
 *  - We open a Supabase Realtime channel filtered to this conversation;
 *    incoming INSERTs are merged into local state, deduped by message id,
 *    so optimistic + server-confirmed rows never double up.
 *  - Send is optimistic: the textarea clears immediately and a temp
 *    message (id `temp-…`) appears in the list. On success we replace
 *    the temp row with the server row; on failure we drop it and show
 *    a toast.
 *  - We PUT /read on mount and again whenever the user is at the bottom
 *    of the thread when a new message arrives, so unread badges decay
 *    naturally.
 *
 * `Enter` submits, `Shift+Enter` inserts a line break — the standard
 * chat convention. The character count flips red past 1900 to warn the
 * user before the server-side 2000-cap rejects the request.
 */
interface ChatViewProps {
  conversationId: string;
  otherUser: ProfileSnapshotWithFollow | null;
  /** Optional back-button visibility — used on mobile detail route. */
  showBackButton?: boolean;
  backHref?: string;
  /** Notifies parent (the list panel) that this conv was just read. */
  onRead?: () => void;
}

interface DisplayMessage extends Message {
  /** Marks an in-flight optimistic row that hasn't been ack'd yet. */
  pending?: boolean;
}

export function ChatView({
  conversationId,
  otherUser,
  showBackButton = false,
  backHref = "/kozosseg/uzenetek",
  onRead,
}: ChatViewProps) {
  const { user } = useAuth();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Load history. The async IIFE pattern keeps the synchronous setState
  // calls (`setLoading`, `setMessages`) outside the effect body itself,
  // which avoids tripping React 19's `react-hooks/set-state-in-effect`.
  useEffect(() => {
    const c = new AbortController();
    void (async () => {
      setLoading(true);
      setMessages([]);
      try {
        const { messages: rows } = await fetchMessages(
          conversationId,
          { limit: 50 },
          c.signal,
        );
        if (c.signal.aborted) return;
        setMessages(rows);
      } catch (err) {
        if (c.signal.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Üzenetek betöltése sikertelen",
        );
      } finally {
        if (!c.signal.aborted) setLoading(false);
      }
    })();
    return () => c.abort();
  }, [conversationId, toast]);

  // Mark as read once history is in.
  useEffect(() => {
    if (loading) return;
    void (async () => {
      try {
        await markConversationRead(conversationId);
        onRead?.();
      } catch {
        /* swallow — best effort */
      }
    })();
  }, [conversationId, loading, onRead]);

  // Realtime subscription.
  useEffect(() => {
    const channel = subscribeToConversation(
      supabase,
      conversationId,
      (incoming) => {
        setMessages((prev) => {
          // Skip if we already have it (optimistic was promoted, or a
          // duplicate INSERT slipped through).
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });

        // If the inbound message is from the other user, mark read.
        if (incoming.sender_id !== user?.id) {
          void markConversationRead(conversationId)
            .then(() => onRead?.())
            .catch(() => {});
        }
      },
    );
    return () => {
      void channel.unsubscribe();
    };
  }, [conversationId, supabase, user?.id, onRead]);

  // Auto-scroll on new message.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // RAF so the layout has settled (the new bubble has been measured).
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!user) {
      toast.error("Üzenet küldéséhez be kell jelentkezned");
      return;
    }
    const content = draft.trim();
    if (content.length === 0 || content.length > MAX_LEN || sending) return;

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: DisplayMessage = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      read_at: null,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");
    setSending(true);

    try {
      const saved = await sendMessage(conversationId, content);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...saved } : m)),
      );
    } catch (err) {
      // Roll back the optimistic insert.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(content); // restore input so user can retry
      toast.error(
        err instanceof Error ? err.message : "Üzenet küldése sikertelen",
      );
    } finally {
      setSending(false);
    }
  }, [draft, sending, user, conversationId, toast]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const groups = useMemo(() => groupByDay(messages), [messages]);
  const remaining = MAX_LEN - draft.length;
  const overWarn = remaining < 100;

  return (
    <section
      className={cn(
        "flex h-full min-h-[480px] flex-col",
        "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]/60 backdrop-blur-md",
      )}
      aria-label={`Beszélgetés ${otherUser?.username ?? ""}`}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className={cn(
          "flex items-center gap-3 border-b border-[var(--glass-border)] px-4 py-3",
          "sm:px-5 sm:py-4",
        )}
      >
        {showBackButton && (
          <Link
            href={backHref}
            aria-label="Vissza a beszélgetésekhez"
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              "border border-[var(--glass-border)] text-[var(--text-secondary)]",
              "transition-colors hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
            )}
          >
            <ArrowLeft size={14} aria-hidden />
          </Link>
        )}
        <Avatar
          url={otherUser?.avatar_url ?? null}
          name={otherUser?.username ?? "?"}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-none tracking-wide text-[var(--text-primary)]">
            {otherUser?.username ?? "Ismeretlen szurkoló"}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Privát üzenet
          </p>
        </div>

        {/* F25.4 — inline follow toggle. Hidden until we have an
            authoritative `otherUser`, and on mobile collapses to the
            icon-only variant so it never elbows the username. */}
        {otherUser && (
          <FollowButton
            targetUserId={otherUser.id}
            initialStatus={chatHeaderInitialStatus(otherUser)}
            size="sm"
            className="ml-1 shrink-0"
          />
        )}
      </header>

      {/* ── Scroller ───────────────────────────────────────────── */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 py-5 sm:px-5"
      >
        {loading ? (
          <ChatSkeleton />
        ) : messages.length === 0 ? (
          <EmptyChatState username={otherUser?.username ?? null} />
        ) : (
          <ol className="space-y-5">
            {groups.map((group) => (
              <li key={group.key}>
                <DayDivider label={group.label} />
                <div className="mt-3 space-y-2">
                  <AnimatePresence initial={false}>
                    {group.messages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        own={msg.sender_id === user?.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Composer ───────────────────────────────────────────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className={cn(
          "flex items-end gap-2 border-t border-[var(--glass-border)]",
          "px-3 py-3 sm:px-4 sm:py-4",
        )}
      >
        <div className="relative flex-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN + 50))}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_LEN}
            placeholder="Írj egy üzenetet… (Enter = küldés, Shift+Enter = sortörés)"
            aria-label="Üzenet"
            className={cn(
              "w-full resize-none rounded-[var(--radius-md)] px-3 py-2.5",
              "border border-[var(--glass-border)] bg-[var(--glass-bg)]/70",
              "text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "focus:border-[var(--accent-gold)]/50 focus:outline-none",
              "max-h-32",
            )}
          />
          {overWarn && (
            <span
              className={cn(
                "pointer-events-none absolute bottom-1.5 right-3 text-[10px] tabular-nums",
                remaining < 0
                  ? "text-[var(--accent-red)]"
                  : "text-[var(--text-muted)]",
              )}
            >
              {remaining}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={
            sending || draft.trim().length === 0 || draft.length > MAX_LEN
          }
          aria-label="Küldés"
          className={cn(
            "glass-button-primary inline-flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-xs",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          {sending ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Send size={14} aria-hidden />
          )}
          <span className="hidden sm:inline">Küldés</span>
        </button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponents                                                       */
/* ------------------------------------------------------------------ */

function MessageBubble({
  message,
  own,
}: {
  message: DisplayMessage;
  own: boolean;
}) {
  const time = new Intl.DateTimeFormat("hu-HU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(message.created_at));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn("flex w-full", own ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "group max-w-[78%] rounded-[var(--radius-md)] px-3.5 py-2",
          "text-sm leading-relaxed",
          "transition-opacity",
          message.pending && "opacity-70",
          own
            ? cn(
                "bg-gradient-to-br from-[var(--accent-gold)]/[0.18] to-[var(--accent-gold)]/[0.08]",
                "border border-[var(--accent-gold)]/30 text-[var(--text-primary)]",
              )
            : cn(
                "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "text-[var(--text-primary)]",
              ),
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <span
          className={cn(
            "mt-1 block text-[10px] tabular-nums",
            own
              ? "text-[var(--accent-gold)]/70"
              : "text-[var(--text-muted)]",
          )}
        >
          {time}
          {own && message.pending ? " · küldés…" : ""}
        </span>
      </div>
    </motion.div>
  );
}

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1 bg-[var(--glass-border)]" />
      <span className="font-display text-[10px] uppercase tracking-[0.3em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--glass-border)]" />
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}
        >
          <span
            className={cn(
              "h-9 w-44 animate-pulse rounded-[var(--radius-md)] bg-[var(--glass-bg-hover)]",
            )}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyChatState({ username }: { username: string | null }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <span className="font-display text-2xl tracking-widest text-[var(--accent-gold)]">
        Tiszta lap
      </span>
      <p className="max-w-xs text-sm text-[var(--text-secondary)]">
        Még nincs üzenet közöttetek. Köszönj{" "}
        {username ? <strong>{username}</strong> : "a szurkolótársadnak"}-nak,
        és indítsátok el a beszélgetést.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Day grouping                                                       */
/* ------------------------------------------------------------------ */

interface DayGroup {
  key: string;
  label: string;
  messages: DisplayMessage[];
}

function groupByDay(messages: DisplayMessage[]): DayGroup[] {
  const out: DayGroup[] = [];
  let lastKey = "";

  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const longFmt = new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  for (const msg of messages) {
    const d = new Date(msg.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (key !== lastKey) {
      const label =
        d >= today
          ? "Ma"
          : d >= yesterday
            ? "Tegnap"
            : longFmt.format(d);
      out.push({ key, label, messages: [msg] });
      lastKey = key;
    } else {
      out[out.length - 1].messages.push(msg);
    }
  }
  return out;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Translate the partner snapshot's optional `is_following` flag into a
 * `FollowStatus` value the FollowButton can use as `initialStatus`.
 * Returns `null` when the backend hasn't supplied the flag — the
 * button will fall back to its on-mount hydration in that case.
 */
function chatHeaderInitialStatus(
  other: ProfileSnapshotWithFollow,
): FollowStatus | null {
  if (typeof other.is_following !== "boolean") return null;
  return {
    isFollowing: other.is_following,
    isFollowedBy: other.is_followed_by ?? false,
    isMutual: other.is_following && (other.is_followed_by ?? false),
  };
}
