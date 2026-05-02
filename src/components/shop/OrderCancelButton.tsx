"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { OrderStatus } from "@/types/database";
import { cancelOrder } from "@/lib/shop-api";
import { useToast } from "@/providers/ToastProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface OrderCancelButtonProps {
  orderId: string;
  status: OrderStatus;
  /** Called once cancellation succeeds so the parent can refresh its list. */
  onCancelled?: () => void;
}

/**
 * "Lemondás" button + confirmation modal — meant to be embedded in the
 * profile order list (F10).  Exposed as a separate component so F8 ships
 * the cancellation UX even before the profile page exists, and so any
 * other surface (admin order detail, dashboard widget) can drop it in
 * without re-implementing the dialog.
 *
 * Backend rule: orders in 'shipped' or 'delivered' state cannot be
 * cancelled — we mirror that on the client by hiding the button entirely
 * for those statuses.  'cancelled' obviously also hides it.
 */
export function OrderCancelButton({
  orderId,
  status,
  onCancelled,
}: OrderCancelButtonProps) {
  const reduced = useReducedMotion();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "shipped" || status === "delivered" || status === "cancelled") {
    return null;
  }

  const confirm = async () => {
    setBusy(true);
    try {
      await cancelOrder(orderId);
      toast.success("Rendelés lemondva");
      setOpen(false);
      onCancelled?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Lemondás sikertelen",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "text-[var(--accent-red)]",
          "hover:border-[var(--accent-red)] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-red)]",
        )}
      >
        Lemondás
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={() => !busy && setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Rendelés lemondása"
            className="glass-modal-backdrop fixed inset-0 z-[120] flex items-center justify-center px-4 py-8"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={
                reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{
                duration: reduced ? 0.15 : 0.3,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              className={cn(
                "glass-modal glass-border-gradient",
                "relative w-full max-w-md p-6",
              )}
            >
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Bezárás"
                disabled={busy}
                className={cn(
                  "absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full",
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  "hover:bg-[var(--glass-bg-hover)] transition-colors",
                )}
              >
                <X size={18} />
              </button>

              <h2 className="font-display text-2xl tracking-wider text-[var(--text-primary)]">
                Biztosan lemondod?
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                A rendelés státusza &quot;Lemondva&quot;-ra változik, és a
                készletet visszaállítjuk. Ezt a műveletet nem lehet visszavonni.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  className="glass-button-secondary"
                >
                  Mégse
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={busy}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full",
                    "px-6 py-3 font-display text-sm uppercase tracking-[0.08em]",
                    "border border-[var(--accent-red)] bg-[var(--glass-bg-strong)]",
                    "text-[var(--text-primary)]",
                    "hover:bg-[var(--accent-red)] hover:text-white",
                    "transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-red)]",
                    busy && "opacity-70 cursor-not-allowed",
                  )}
                >
                  {busy ? "Lemondás…" : "Igen, lemondom"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
