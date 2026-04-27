"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Ticket } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Reused on /pont-aruhaz (no active coupons in the system) and on
 * /kuponjaim (the user has not redeemed anything yet).
 */

interface CouponEmptyStateProps {
  title: string;
  description: string;
  cta?: { href: string; label: string };
  variant?: "default" | "compact";
}

export function CouponEmptyState({
  title,
  description,
  cta,
  variant = "default",
}: CouponEmptyStateProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn(
        "glass-card flex flex-col items-center text-center",
        variant === "compact"
          ? "px-6 py-10"
          : "px-6 py-14 sm:px-10 sm:py-20",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          "border border-[var(--accent-gold)]/30 bg-[var(--accent-gold-subtle)]",
          "text-[var(--accent-gold)]",
          variant === "compact" ? "h-12 w-12" : "h-16 w-16",
        )}
      >
        <Ticket size={variant === "compact" ? 22 : 28} aria-hidden />
      </div>
      <h3
        className={cn(
          "mt-4 font-display tracking-wider text-[var(--text-primary)]",
          variant === "compact" ? "text-xl" : "text-2xl sm:text-3xl",
        )}
      >
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--text-secondary)]">
        {description}
      </p>
      {cta && (
        <Link href={cta.href} className="glass-button-primary mt-6">
          {cta.label}
        </Link>
      )}
    </motion.div>
  );
}
