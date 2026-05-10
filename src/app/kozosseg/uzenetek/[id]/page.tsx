"use client";

import { use, useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ChatView } from "@/components/social/ChatView";
import { fetchConversations } from "@/lib/dm-api";
import { useToast } from "@/providers/ToastProvider";
import type { EnrichedConversation } from "@/types/dm";
import { cn } from "@/lib/utils";

/**
 * /kozosseg/uzenetek/[id] — mobile-first dedicated detail route.
 *
 * On desktop the parent /uzenetek route already renders both panels in a
 * split, but on mobile we want a back-stack experience: tapping a row
 * leaves the list and navigates here. The chat view itself is identical;
 * we just wrap it with the "back" affordance.
 *
 * Conversation metadata (the other user's profile) is resolved by
 * pulling the row from the same /api/conversations endpoint the list
 * uses — there is no dedicated `/api/conversations/[id]` GET. The
 * round-trip is small and means we always show the same enriched
 * shape as the list panel.
 */
interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ConversationDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <ProtectedRoute>
      <DetailContent conversationId={id} />
    </ProtectedRoute>
  );
}

function DetailContent({ conversationId }: { conversationId: string }) {
  const toast = useToast();
  const [conv, setConv] = useState<EnrichedConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const list = await fetchConversations(signal);
        if (signal?.aborted) return;
        const match = list.find((c) => c.id === conversationId) ?? null;
        if (!match) {
          setNotFound(true);
          return;
        }
        setConv(match);
      } catch (err) {
        if (signal?.aborted) return;
        toast.error(
          err instanceof Error ? err.message : "Beszélgetés betöltése sikertelen",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [conversationId, toast],
  );

  useEffect(() => {
    const c = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload(c.signal);
    return () => c.abort();
  }, [reload]);

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 py-6 sm:px-6 sm:py-10">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-5"
      >
        <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
          Privát üzenet
        </p>
      </motion.header>

      {loading ? (
        <div
          aria-hidden
          className={cn(
            "h-[70vh] min-h-[480px] animate-pulse",
            "rounded-[var(--radius-lg)] border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          )}
        />
      ) : notFound ? (
        <section
          className={cn(
            "flex min-h-[400px] flex-col items-center justify-center gap-3 text-center",
            "rounded-[var(--radius-lg)] border border-dashed border-[var(--glass-border)]",
            "bg-[var(--glass-bg)]/40 p-8",
          )}
        >
          <p className="font-display text-3xl tracking-widest text-[var(--accent-gold)]">
            Nincs ilyen beszélgetés
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            Lehet, hogy törölve lett, vagy nem te vagy a résztvevő.
          </p>
        </section>
      ) : (
        <div className="h-[calc(100vh-12rem)] min-h-[480px]">
          <ChatView
            conversationId={conversationId}
            otherUser={conv?.otherUser ?? null}
            showBackButton
            backHref="/kozosseg/uzenetek"
            onRead={() => void reload()}
          />
        </div>
      )}
    </div>
  );
}
