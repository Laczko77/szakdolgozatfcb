"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useToast } from "@/providers/ToastProvider";
import { postReview } from "@/lib/shop-api";
import { cn } from "@/lib/utils";
import { RatingStars } from "./RatingStars";

interface ReviewModalProps {
  productId: string;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const MAX_LENGTH = 600;

/**
 * Glass modal for writing a single product review.
 *
 * The form is minimal by design:
 *   - 1–5 star rating (required)
 *   - 600-char comment (optional)
 *   - "Küldés" submit
 *
 * The server enforces UNIQUE (product_id, user_id), so a duplicate
 * submission surfaces as a 409 — we forward the message to the toast
 * system rather than handling it inline.
 */
export function ReviewModal({
  productId,
  open,
  onClose,
  onSubmitted,
}: ReviewModalProps) {
  const reduced = useReducedMotion();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset state on open so reopening the modal doesn't surprise the user.
  // Deferred via microtask to avoid a synchronous setState in the effect.
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setRating(0);
        setComment("");
      });
    }
  }, [open]);

  // Escape closes the modal — same convention as the cart drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (rating < 1 || rating > 5) {
      toast.error("Válassz 1 és 5 csillag közötti értékelést");
      return;
    }
    setSubmitting(true);
    try {
      await postReview(productId, rating, comment.trim() || null);
      toast.success("Köszönjük az értékelést!");
      onSubmitted();
      onClose();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Értékelés sikertelen",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="review-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Értékelés írása"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.2 }}
          onClick={onClose}
          className="glass-modal-backdrop fixed inset-0 z-[120] flex items-center justify-center px-4 py-8"
        >
          <motion.form
            key="review-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.96 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }}
            transition={{
              duration: reduced ? 0.15 : 0.32,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            className={cn(
              "glass-modal glass-border-gradient",
              "relative w-full max-w-md overflow-hidden p-6",
            )}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Bezárás"
              className={cn(
                "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full",
                "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--glass-bg-hover)] transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              )}
            >
              <X size={18} />
            </button>

            <h2 className="font-display text-2xl tracking-wider text-[var(--text-primary)]">
              Értékelés írása
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Mondd el a többi szurkolónak, hogyan tetszett ez a termék.
            </p>

            <div className="mt-6 flex flex-col items-center gap-2">
              <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Hány csillagot adsz?
              </span>
              <RatingStars
                value={rating}
                interactive
                onChange={setRating}
                size={18}
              />
            </div>

            <div className="mt-6">
              <label
                htmlFor="review-comment"
                className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]"
              >
                Megjegyzés (nem kötelező)
              </label>
              <textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_LENGTH))}
                rows={4}
                className={cn(
                  "mt-2 w-full resize-none rounded-md px-3 py-2 text-sm",
                  "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                  "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  "focus:border-[var(--accent-gold)] focus:outline-none",
                  "transition-colors",
                )}
                placeholder="Mit gondolsz a termékről?"
              />
              <div className="mt-1 text-right text-xs text-[var(--text-muted)]">
                {comment.length} / {MAX_LENGTH}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="glass-button-secondary"
                disabled={submitting}
              >
                Mégse
              </button>
              <button
                type="submit"
                className="glass-button-primary"
                disabled={submitting || rating < 1}
              >
                {submitting ? "Küldés…" : "Küldés"}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
