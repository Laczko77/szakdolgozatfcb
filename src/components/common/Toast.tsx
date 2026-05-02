"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Info,
  AlertCircle,
  Sparkles,
  X,
} from "lucide-react";
import type { ToastItem, ToastType } from "@/providers/ToastProvider";
import { toastSlide } from "@/lib/animation/motion";
import { cn } from "@/lib/utils";

interface ToastProps {
  toast: ToastItem;
  onClose: (id: string) => void;
}

const ICONS: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  points: Sparkles,
};

const ACCENT: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-[var(--accent-red)]",
  info: "text-[var(--accent-blue)]",
  points: "text-[var(--accent-gold)]",
};

const RING: Record<ToastType, string> = {
  success: "shadow-[0_0_24px_rgba(16,185,129,0.25)]",
  error: "shadow-glow-red",
  info: "shadow-glow-blue",
  points: "shadow-glow-gold",
};

export function Toast({ toast, onClose }: ToastProps) {
  const Icon = ICONS[toast.type];

  return (
    <motion.div
      layout
      variants={toastSlide}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        "glass-modal glass-border-gradient pointer-events-auto",
        "flex w-full max-w-sm items-start gap-3 px-4 py-3",
        "min-w-[280px]",
        RING[toast.type],
      )}
      role={toast.type === "error" ? "alert" : "status"}
    >
      <Icon
        className={cn("mt-0.5 h-5 w-5 shrink-0", ACCENT[toast.type])}
        aria-hidden
      />

      <div className="flex-1 min-w-0">
        {toast.title ? (
          <p className="font-display text-text-primary text-sm uppercase tracking-wider">
            {toast.title}
          </p>
        ) : null}
        <p className="text-text-primary text-sm leading-snug">
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onClose(toast.id)}
        className="text-text-muted hover:text-text-primary -mr-1 -mt-1 shrink-0 rounded-full p-1 transition-colors"
        aria-label="Értesítés bezárása"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
