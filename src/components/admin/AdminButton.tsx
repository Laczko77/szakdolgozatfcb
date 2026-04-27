"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type AdminButtonSize = "sm" | "md" | "lg" | "icon";

interface AdminButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  loading?: boolean;
}

const VARIANT_STYLES: Record<AdminButtonVariant, string> = {
  primary: cn(
    "bg-[var(--accent-gold)] text-[#0a0e1a]",
    "hover:bg-[var(--accent-gold)]/90",
    "shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_4px_14px_-4px_rgba(245,158,11,0.5)]",
  ),
  secondary: cn(
    "bg-[var(--bg-tertiary)] text-[var(--text-primary)]",
    "hover:bg-[var(--bg-tertiary)]/80",
    "border border-[var(--glass-border)]",
  ),
  ghost: cn(
    "bg-transparent text-[var(--text-primary)]",
    "hover:bg-[var(--glass-bg-hover)]",
  ),
  danger: cn(
    "bg-[var(--accent-red)] text-white",
    "hover:bg-[var(--accent-red)]/90",
  ),
  subtle: cn(
    "bg-[var(--glass-bg)] text-[var(--text-secondary)]",
    "hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
    "border border-[var(--glass-border)]",
  ),
};

const SIZE_STYLES: Record<AdminButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-6 text-sm gap-2",
  icon: "h-9 w-9 p-0",
};

/**
 * Admin-flavored button. Sharper geometry than the public site's pill
 * buttons (rounded-md, not pill), tighter typography, no glass.
 */
export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  function AdminButton(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium",
          "transition-[background-color,color,box-shadow,transform] duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]",
          "active:translate-y-[0.5px]",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
          "[&_svg]:pointer-events-none [&_svg]:shrink-0",
          VARIANT_STYLES[variant],
          SIZE_STYLES[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {children}
      </button>
    );
  },
);
