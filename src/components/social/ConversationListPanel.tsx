"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquarePlus } from "lucide-react";
import { RelativeTime } from "./RelativeTime";
import { Avatar } from "./Avatar";
import type { EnrichedConversation } from "@/types/dm";
import { cn } from "@/lib/utils";

/**
 * Left panel of the /kozosseg/uzenetek view (and the full mobile route).
 *
 * Renders the caller's conversations sorted by `last_message_at` desc.
 * Each row shows the other participant's avatar + username, the truncated
 * last message, a relative timestamp and an unread counter pill.
 *
 * The panel is a client component but data-dumb: the parent owns the
 * fetch + selection state. We keep the row layout tight (max two visual
 * rows of text) so the column reads cleanly even at 320px wide.
 */
interface ConversationListPanelProps {
  conversations: EnrichedConversation[];
  loading: boolean;
  /** Currently active conversation id — for highlight + aria-current. */
  activeId: string | null;
  /** Click handler for desktop in-place selection. */
  onSelect: (id: string) => void;
  onNewMessage: () => void;
  /**
   * When true, rows render as <Link> elements pointing to the dedicated
   * /kozosseg/uzenetek/[id] route. Used by the mobile detail flow.
   */
  useLinks?: boolean;
}

export function ConversationListPanel({
  conversations,
  loading,
  activeId,
  onSelect,
  onNewMessage,
  useLinks = false,
}: ConversationListPanelProps) {
  return (
    <section
      aria-label="Beszélgetések"
      className={cn(
        "flex h-full min-h-[480px] flex-col",
        "rounded-[var(--radius-lg)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]/60 backdrop-blur-md",
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-[var(--glass-border)] px-4 py-4 sm:px-5">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Üzenetek
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {loading
              ? "Betöltés…"
              : conversations.length === 0
                ? "Még nincs beszélgetésed"
                : `${conversations.length} szál`}
          </p>
        </div>
        <button
          type="button"
          onClick={onNewMessage}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full",
            "border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/[0.08]",
            "px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.18em] text-[var(--accent-gold)]",
            "transition-all duration-200",
            "hover:bg-[var(--accent-gold)]/[0.14] hover:border-[var(--accent-gold)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
          )}
        >
          <MessageSquarePlus size={12} aria-hidden />
          <span>Új</span>
        </button>
      </header>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ListSkeleton />
        ) : conversations.length === 0 ? (
          <EmptyList />
        ) : (
          <ul className="px-2 py-2">
            {conversations.map((conv, idx) => (
              <motion.li
                key={conv.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.32,
                  delay: Math.min(idx * 0.03, 0.18),
                  ease: "easeOut",
                }}
              >
                <ConvRow
                  conv={conv}
                  active={activeId === conv.id}
                  onSelect={() => onSelect(conv.id)}
                  useLink={useLinks}
                />
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ConvRow({
  conv,
  active,
  onSelect,
  useLink,
}: {
  conv: EnrichedConversation;
  active: boolean;
  onSelect: () => void;
  useLink: boolean;
}) {
  const username = conv.otherUser?.username ?? "Ismeretlen szurkoló";
  const lastText = conv.lastMessage?.content ?? "Még nincs üzenet";
  const ts = conv.lastMessage?.created_at ?? conv.created_at;
  const unread = conv.unreadCount > 0;

  const inner = (
    <span
      className={cn(
        "relative flex w-full items-start gap-3 rounded-[var(--radius-md)] px-3 py-3",
        "border border-transparent transition-all duration-200",
        active
          ? "border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/[0.08]"
          : "hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-1 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-[var(--accent-gold)]"
        />
      )}
      <Avatar url={conv.otherUser?.avatar_url ?? null} name={username} size={40} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={cn(
              "truncate text-sm",
              unread || active
                ? "font-semibold text-[var(--text-primary)]"
                : "text-[var(--text-primary)]",
            )}
          >
            {username}
          </span>
          <RelativeTime
            iso={ts}
            className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)]"
          />
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-xs",
              unread
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)]",
            )}
          >
            {lastText}
          </span>
          {unread && (
            <span
              className={cn(
                "shrink-0 rounded-full bg-[var(--accent-red)] px-1.5 py-0.5",
                "font-display text-[10px] tabular-nums tracking-wider text-white",
              )}
              aria-label={`${conv.unreadCount} olvasatlan`}
            >
              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
            </span>
          )}
        </span>
      </span>
    </span>
  );

  if (useLink) {
    return (
      <Link
        href={`/kozosseg/uzenetek/${conv.id}`}
        aria-current={active ? "true" : undefined}
        className="block"
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className="block w-full text-left"
    >
      {inner}
    </button>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-3"
        >
          <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          <span className="min-w-0 flex-1 space-y-2">
            <span className="block h-3 w-1/2 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
            <span className="block h-3 w-3/4 animate-pulse rounded-full bg-[var(--glass-bg-hover)]" />
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyList() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span className="font-display text-2xl tracking-widest text-[var(--accent-gold)]">
        Nincs üzenet
      </span>
      <p className="max-w-[16rem] text-xs text-[var(--text-secondary)]">
        Nincs még beszélgetésed. Kezdj egyet az „Új” gombbal — kölcsönös
        követés szükséges.
      </p>
    </div>
  );
}
