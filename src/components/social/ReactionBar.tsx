"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SmilePlus } from "lucide-react";
import type { ReactionTarget } from "@/types/database";
import type { OwnReaction } from "@/types/social";
import { cn } from "@/lib/utils";

/**
 * Reaction picker palette.
 *
 * Six emoji is the sweet spot the backlog calls for — wide enough to
 * cover the main emotional registers (love, applause, wonder, joy,
 * surprise, hype) without becoming a sticker browser.
 */
export const REACTION_EMOJIS = ["❤️", "👏", "😍", "😂", "😮", "💪"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number] | string;

interface ReactionBarProps {
  targetType: ReactionTarget;
  targetId: string;
  /** Per-emoji counts as returned by the server. */
  reactions: Record<string, number>;
  /** The caller's own reaction on this target, or undefined if none. */
  ownReaction: OwnReaction | undefined;
  /**
   * The caller is signed in. When false the bar shows aggregate
   * counts but the picker is disabled and triggers `onRequireLogin`.
   */
  canReact: boolean;
  onAdd: (emoji: string) => Promise<void> | void;
  onSwap: (emoji: string) => Promise<void> | void;
  onRevoke: () => Promise<void> | void;
  onRequireLogin?: () => void;
  /** Smaller layout for inline use under comments. */
  compact?: boolean;
}

/**
 * F11.2 — Reaction summary bar with pop-out emoji picker.
 *
 * The trigger is the leftmost "+" button; clicking it scales in a
 * row of 6 emojis. The summary chips on the right show the live
 * counts; the user's own emoji is highlighted with a gold ring. A
 * second click on the same emoji revokes; clicking a different one
 * swaps server-side (the row id stays stable, see /api/reactions).
 */
export function ReactionBar({
  targetType,
  targetId,
  reactions,
  ownReaction,
  canReact,
  onAdd,
  onSwap,
  onRevoke,
  onRequireLogin,
  compact = false,
}: ReactionBarProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Outside-click + Escape dismiss for the picker. Without this the
  // picker would feel stuck open when the user just wanted to look
  // somewhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handlePick = async (emoji: string) => {
    if (busy) return;
    if (!canReact) {
      onRequireLogin?.();
      setOpen(false);
      return;
    }

    setBusy(true);
    try {
      if (!ownReaction) {
        await onAdd(emoji);
      } else if (ownReaction.emoji === emoji) {
        await onRevoke();
      } else {
        await onSwap(emoji);
      }
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  // Render the displayed list of emoji chips. We only show emojis with
  // a positive count to keep the row visually quiet.
  const chips = Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  // We're suppressing the unused-var warning because target ids are
  // logged inside parent error handlers — keeping these in the props
  // surface keeps the component reusable for both posts and comments.
  void targetType;
  void targetId;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-wrap items-center gap-1.5",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      {/* Picker trigger ("+") */}
      <button
        type="button"
        onClick={() => {
          if (!canReact) {
            onRequireLogin?.();
            return;
          }
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Reakció hozzáadása"
        className={cn(
          "inline-flex items-center justify-center rounded-full border transition",
          "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]",
          "hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
          compact ? "h-6 w-6" : "h-7 w-7",
          busy && "opacity-50",
        )}
      >
        <SmilePlus size={compact ? 12 : 14} aria-hidden />
      </button>

      {/* Reaction chips (counts) */}
      <AnimatePresence initial={false}>
        {chips.map(([emoji, count]) => {
          const isOwn = ownReaction?.emoji === emoji;
          return (
            <motion.button
              key={emoji}
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
              onClick={() => void handlePick(emoji)}
              aria-pressed={isOwn}
              aria-label={`${emoji} reakció — ${count} db`}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 leading-none transition",
                isOwn
                  ? "border-[var(--accent-gold)] bg-[var(--accent-gold-subtle)] text-[var(--accent-gold)] shadow-[0_0_12px_rgba(196,163,77,0.35)]"
                  : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:border-[var(--glass-border-hover)] hover:bg-[var(--glass-bg-hover)]",
                compact ? "h-6 text-[11px]" : "h-7 text-xs",
                busy && "pointer-events-none opacity-70",
              )}
            >
              <span aria-hidden className="text-sm leading-none">
                {emoji}
              </span>
              <span className="font-semibold tabular-nums">{count}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>

      {/* Picker pop-out */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="menu"
            className={cn(
              "absolute left-0 top-full z-30 mt-2 flex items-center gap-1.5",
              "rounded-full border border-[var(--glass-border-hover)] bg-[var(--glass-bg-strong)] p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl",
            )}
          >
            {REACTION_EMOJIS.map((emoji, i) => (
              <motion.button
                key={emoji}
                type="button"
                role="menuitem"
                onClick={() => void handlePick(emoji)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.18,
                  delay: i * 0.025,
                  ease: "easeOut",
                }}
                whileHover={{ scale: 1.25, y: -2 }}
                whileTap={{ scale: 0.92 }}
                aria-label={`Reakció: ${emoji}`}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none transition",
                  ownReaction?.emoji === emoji &&
                    "ring-2 ring-[var(--accent-gold)] ring-offset-2 ring-offset-[var(--glass-bg-strong)]",
                )}
              >
                <span aria-hidden>{emoji}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
