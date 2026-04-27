"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Admin-flavored modal — solid surface, sharper geometry, no glass.
 *
 * Built on @radix-ui/react-dialog so we keep the focus trap, escape key,
 * and aria wiring for free. Animation is Framer Motion driven to match
 * the rest of the project's animation grammar (reduced-motion respected
 * globally via `globals.css`).
 */

export const AdminDialogRoot = DialogPrimitive.Root;
export const AdminDialogTrigger = DialogPrimitive.Trigger;
export const AdminDialogClose = DialogPrimitive.Close;

interface AdminDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: "sm" | "md" | "lg" | "xl";
  open?: boolean;
}

const SIZE_CLASS: Record<NonNullable<AdminDialogContentProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export const AdminDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AdminDialogContentProps
>(function AdminDialogContent(
  { size = "md", className, children, open, ...props },
  ref,
) {
  return (
    <AnimatePresence>
      {open ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            />
          </DialogPrimitive.Overlay>
          <DialogPrimitive.Content asChild ref={ref} {...props}>
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
                "rounded-lg border border-[var(--glass-border-hover)]",
                "bg-[var(--bg-secondary)] shadow-2xl",
                "max-h-[calc(100vh-2rem)] overflow-y-auto",
                SIZE_CLASS[size],
                className,
              )}
            >
              {children}
              <DialogPrimitive.Close
                className={cn(
                  "absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md",
                  "text-[var(--text-secondary)] transition-colors",
                  "hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                )}
                aria-label="Bezárás"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </AnimatePresence>
  );
});

export function AdminDialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-b border-[var(--glass-border)] px-6 py-5 pr-12",
        className,
      )}
      {...props}
    />
  );
}

export const AdminDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function AdminDialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn(
        "font-display text-xl uppercase tracking-[0.06em] text-[var(--text-primary)]",
        className,
      )}
      {...props}
    />
  );
});

export const AdminDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function AdminDialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn(
        "mt-1.5 text-sm text-[var(--text-secondary)]",
        className,
      )}
      {...props}
    />
  );
});

export function AdminDialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
}

export function AdminDialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-[var(--glass-border)] px-6 py-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}
