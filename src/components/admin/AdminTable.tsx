import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Admin table primitives — a thin, opinionated wrapper around <table>
 * elements. Distinct visual language from the public site:
 *
 *   - Sharp corners only on the outer container, never on the row.
 *   - Header row uses the project's display font in uppercase tracking-wide
 *     so the table reads like a sports stat block.
 *   - Hairline row separators in `--glass-border` for a quiet rhythm.
 *   - Hover state on body rows is a brief `--glass-bg-hover` wash — barely
 *     visible but enough to confirm the cursor is on the right row.
 */

export const AdminTableContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function AdminTableContainer({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full overflow-x-auto rounded-md border border-[var(--glass-border)]",
        "bg-[var(--bg-secondary)]",
        className,
      )}
      {...props}
    />
  );
});

export const AdminTable = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(function AdminTableInner({ className, ...props }, ref) {
  return (
    <table
      ref={ref}
      className={cn("w-full border-collapse text-sm", className)}
      {...props}
    />
  );
});

export const AdminTHead = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function AdminTHead({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn(
        "border-b border-[var(--glass-border)] bg-[var(--bg-tertiary)]/40",
        className,
      )}
      {...props}
    />
  );
});

export const AdminTBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function AdminTBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn(className)} {...props} />;
});

export const AdminTR = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(function AdminTR({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b border-[var(--glass-border)] last:border-0",
        "transition-colors duration-150 hover:bg-[var(--glass-bg-hover)]",
        className,
      )}
      {...props}
    />
  );
});

export const AdminTH = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function AdminTH({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      className={cn(
        "h-10 px-4 text-left align-middle",
        "font-display text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]",
        className,
      )}
      {...props}
    />
  );
});

export const AdminTD = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function AdminTD({ className, ...props }, ref) {
  return (
    <td
      ref={ref}
      className={cn(
        "px-4 py-3 align-middle text-sm text-[var(--text-primary)]",
        className,
      )}
      {...props}
    />
  );
});

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function AdminTableEmpty({
  title,
  description,
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon ? (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--glass-border)] text-[var(--text-muted)]">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-lg uppercase tracking-[0.08em] text-[var(--text-primary)]">
        {title}
      </p>
      {description ? (
        <p className="max-w-md text-sm text-[var(--text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

interface AdminTableSkeletonProps {
  columns: number;
  rows?: number;
}

/**
 * Minimal pulse skeleton for table loading states. Renders `rows × columns`
 * grey rectangles that match the row height of the real table.
 */
export function AdminTableSkeleton({
  columns,
  rows = 8,
}: AdminTableSkeletonProps) {
  return (
    <tbody aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <tr
          key={r}
          className="border-b border-[var(--glass-border)] last:border-0"
        >
          {Array.from({ length: columns }).map((__, c) => (
            <td key={c} className="px-4 py-4">
              <div className="h-3 w-full max-w-[160px] animate-pulse rounded bg-[var(--glass-bg-strong)]" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
