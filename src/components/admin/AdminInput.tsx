import * as React from "react";
import { cn } from "@/lib/utils";

const FIELD_BASE = cn(
  "w-full rounded-md border border-[var(--glass-border)]",
  "bg-[var(--bg-primary)] text-[var(--text-primary)]",
  "placeholder:text-[var(--text-muted)]",
  "transition-[border-color,box-shadow] duration-150",
  "focus-visible:outline-none focus-visible:border-[var(--accent-gold)] focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/30",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export const AdminInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function AdminInput({ className, type = "text", ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(FIELD_BASE, "h-9 px-3 text-sm", className)}
      {...props}
    />
  );
});

export const AdminTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AdminTextarea({ className, rows = 4, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(FIELD_BASE, "px-3 py-2 text-sm leading-relaxed", className)}
      {...props}
    />
  );
});

export const AdminLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function AdminLabel({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn(
        "block text-[11px] font-semibold uppercase tracking-[0.1em]",
        "text-[var(--text-secondary)]",
        className,
      )}
      {...props}
    />
  );
});

interface AdminFieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function AdminField({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: AdminFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <AdminLabel htmlFor={htmlFor}>{label}</AdminLabel>
      {children}
      {error ? (
        <p className="text-xs font-medium text-[var(--accent-red)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
