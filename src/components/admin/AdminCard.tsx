import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Solid surface card for the admin panel.
 *
 * Deliberately NOT glass — admin is a working tool, not a showcase.
 * Uses `--bg-secondary` for the surface and a hairline border so cards
 * read as flat rectangles on the page rather than floating slabs.
 */
export const AdminCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AdminCard({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-md border border-[var(--glass-border)]",
        "bg-[var(--bg-secondary)]",
        "shadow-[0_1px_0_rgba(255,255,255,0.02)]",
        className,
      )}
      {...props}
    />
  );
});

export const AdminCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AdminCardHeader({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-4 border-b border-[var(--glass-border)] px-5 py-4",
        className,
      )}
      {...props}
    />
  );
});

export const AdminCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function AdminCardTitle({ className, ...props }, ref) {
  return (
    <h2
      ref={ref}
      className={cn(
        "font-display text-xl uppercase tracking-[0.06em] text-[var(--text-primary)]",
        className,
      )}
      {...props}
    />
  );
});

export const AdminCardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AdminCardBody({ className, ...props }, ref) {
  return <div ref={ref} className={cn("p-5", className)} {...props} />;
});
