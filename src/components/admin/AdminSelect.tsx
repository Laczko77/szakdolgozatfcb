import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AdminSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * Native <select> styled to match the admin design language. We use the
 * native control here (rather than the radix Select primitive) because
 * the admin table filters benefit from native keyboard-search behaviour
 * and the predictable mobile picker.
 */
export const AdminSelect = React.forwardRef<HTMLSelectElement, AdminSelectProps>(
  function AdminSelect({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "h-9 w-full appearance-none rounded-md border border-[var(--glass-border)]",
            "bg-[var(--bg-primary)] pl-3 pr-9 text-sm text-[var(--text-primary)]",
            "transition-[border-color,box-shadow] duration-150",
            "focus-visible:outline-none focus-visible:border-[var(--accent-gold)] focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
        />
      </div>
    );
  },
);
