"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ConversationListPanel } from "@/components/social/ConversationListPanel";
import { ChatView } from "@/components/social/ChatView";
import { NewConversationModal } from "@/components/social/NewConversationModal";
import { fetchConversations } from "@/lib/dm-api";
import { useToast } from "@/providers/ToastProvider";
import type { EnrichedConversation } from "@/types/dm";
import { cn } from "@/lib/utils";

/**
 * /kozosseg/uzenetek — F23 DM hub.
 *
 * Layout:
 *  - Desktop (≥md): two-panel grid. Left column = conversation list
 *    (320px), right column = active chat. The active conversation is
 *    tracked via the `?c=<id>` query parameter so it survives reloads
 *    and is deep-linkable from the navbar dropdown / notifications.
 *  - Mobile (<md): the list takes the full width and rows are rendered
 *    as <Link>s pointing to /kozosseg/uzenetek/[id], matching the
 *    "list / detail" navigation pattern requested in the backlog.
 *
 * The list is fetched once on mount and re-fetched whenever the user
 * marks a conversation as read (so unread counters update without a
 * full reload).
 */
export default function DmHubPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<DmHubFallback />}>
        <DmHubContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function DmHubContent() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const activeIdQuery = params.get("c");

  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data = await fetchConversations(signal);
        if (signal?.aborted) return;
        setConversations(data);
      } catch (err) {
        if (signal?.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Beszélgetések betöltése sikertelen",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    const c = new AbortController();
    void reload(c.signal);
    return () => c.abort();
  }, [reload]);

  const activeConv = useMemo(() => {
    if (!activeIdQuery) return null;
    return conversations.find((c) => c.id === activeIdQuery) ?? null;
  }, [activeIdQuery, conversations]);

  const setActive = useCallback(
    (id: string) => {
      const sp = new URLSearchParams(params.toString());
      sp.set("c", id);
      router.replace(`/kozosseg/uzenetek?${sp.toString()}`, { scroll: false });
    },
    [params, router],
  );

  const handleConversationCreated = useCallback(
    (id: string) => {
      setModalOpen(false);
      // Refresh the list so the new (or now-promoted) thread appears.
      void reload();
      setActive(id);
    },
    [reload, setActive],
  );

  // Fired by ChatView after PUT /read succeeds.
  const handleRead = useCallback(() => {
    void reload();
  }, [reload]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-10">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 sm:mb-8"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Privát
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-4xl sm:text-5xl",
          )}
        >
          Üzenetek
        </h1>
        <p className="mt-3 max-w-[40rem] text-sm text-[var(--text-secondary)]">
          Privát beszélgetések kölcsönösen követett szurkolókkal. Az
          üzenetek élőben érkeznek — nem kell frissítened az oldalt.
        </p>
      </motion.header>

      {/* Mobile: list-only view (rows link to the [id] route). */}
      <div className="md:hidden">
        <ConversationListPanel
          conversations={conversations}
          loading={loading}
          activeId={null}
          onSelect={() => {
            /* unused on mobile, links handle it */
          }}
          onNewMessage={() => setModalOpen(true)}
          useLinks
        />
      </div>

      {/* Desktop / tablet: two-panel split. */}
      <div className="hidden md:grid md:grid-cols-[320px_minmax(0,1fr)] md:gap-5 lg:gap-6">
        <ConversationListPanel
          conversations={conversations}
          loading={loading}
          activeId={activeIdQuery}
          onSelect={setActive}
          onNewMessage={() => setModalOpen(true)}
        />

        {activeConv ? (
          <ChatView
            key={activeConv.id}
            conversationId={activeConv.id}
            otherUser={activeConv.otherUser}
            onRead={handleRead}
          />
        ) : (
          <EmptyChatPlaceholder />
        )}
      </div>

      <NewConversationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleConversationCreated}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function EmptyChatPlaceholder() {
  return (
    <section
      className={cn(
        "flex min-h-[480px] flex-col items-center justify-center gap-3 text-center",
        "rounded-[var(--radius-lg)] border border-dashed border-[var(--glass-border)]",
        "bg-[var(--glass-bg)]/40 p-10",
      )}
    >
      <p className="font-display text-3xl tracking-widest text-[var(--accent-gold)]">
        Válassz egy beszélgetést
      </p>
      <p className="max-w-md text-sm text-[var(--text-secondary)]">
        A bal oldali listából nyiss meg egy szálat, vagy indíts újat a{" "}
        <span className="text-[var(--accent-gold)]">+ Új</span> gombbal.
      </p>
    </section>
  );
}

function DmHubFallback() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="h-10 w-40 animate-pulse rounded-full bg-[var(--glass-bg-hover)]"
      />
      <div
        aria-hidden
        className="mt-8 h-[480px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--glass-bg)]"
      />
    </div>
  );
}
