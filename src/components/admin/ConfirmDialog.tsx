"use client";

import { AlertTriangle } from "lucide-react";
import { AdminButton } from "./AdminButton";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "./AdminDialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Megerősítés",
  cancelLabel = "Mégse",
  variant = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AdminDialogRoot open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent open={open} size="sm">
        <AdminDialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={
                variant === "danger"
                  ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-red)]/15 text-[var(--accent-red)]"
                  : "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--accent-gold)]/15 text-[var(--accent-gold)]"
              }
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <AdminDialogTitle>{title}</AdminDialogTitle>
              <AdminDialogDescription>{description}</AdminDialogDescription>
            </div>
          </div>
        </AdminDialogHeader>
        <AdminDialogBody className="hidden" />
        <AdminDialogFooter>
          <AdminButton
            variant="subtle"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </AdminButton>
          <AdminButton
            variant={variant}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </AdminButton>
        </AdminDialogFooter>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}
