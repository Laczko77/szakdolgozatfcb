"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminButton } from "./AdminButton";

interface ImageDropzoneProps {
  /** Current file (newly uploaded by the admin in this session). */
  file: File | null;
  /** Existing image URL persisted on the server, when editing. */
  existingUrl?: string | null;
  /** Triggered for both browse and drop. */
  onFileChange: (file: File | null) => void;
  /** Triggered when the admin removes the existing server-side image. */
  onRemoveExisting?: () => void;
  accept?: string;
  /** Bytes — defaults to 8 MB. */
  maxSize?: number;
  className?: string;
}

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/avif";
const DEFAULT_MAX = 8 * 1024 * 1024;

/**
 * Hand-rolled drag & drop image uploader.
 *
 * Two visual modes:
 *  1. Empty — dashed bordered box, "Húzd ide a képet" prompt.
 *  2. Preview — image fills the frame; remove button overlays on hover.
 *
 * Reactivity: when `file` prop changes we generate an Object URL preview
 * and revoke it on cleanup so we don't leak blob: URLs.
 */
export function ImageDropzone({
  file,
  existingUrl,
  onFileChange,
  onRemoveExisting,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX,
  className,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate / revoke a blob URL whenever `file` changes. setState calls
  // are wrapped in queueMicrotask so the effect body itself doesn't
  // trigger a cascading render (eslint: react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!file) {
      queueMicrotask(() => setPreviewUrl(null));
      return;
    }
    const url = URL.createObjectURL(file);
    queueMicrotask(() => setPreviewUrl(url));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validate = useCallback(
    (next: File): string | null => {
      if (next.size > maxSize) {
        return `A fájl túl nagy (max ${(maxSize / (1024 * 1024)).toFixed(0)} MB)`;
      }
      const types = accept.split(",").map((t) => t.trim());
      if (types.length > 0 && !types.includes(next.type)) {
        return "Nem támogatott fájltípus";
      }
      return null;
    },
    [accept, maxSize],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const next = files[0];
      const err = validate(next);
      if (err) {
        setError(err);
        return;
      }
      setError(null);
      onFileChange(next);
    },
    [onFileChange, validate],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const visibleUrl = previewUrl ?? existingUrl ?? null;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Kép feltöltése"
        className={cn(
          "group relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2",
          "rounded-md border-2 border-dashed bg-[var(--bg-primary)] px-4 py-8 text-center",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
          dragActive
            ? "border-[var(--accent-gold)] bg-[var(--accent-gold)]/5"
            : "border-[var(--glass-border)] hover:border-[var(--accent-gold)]/60",
          visibleUrl ? "min-h-[260px]" : null,
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {visibleUrl ? (
          <>
            <div className="relative flex h-[240px] w-full items-center justify-center overflow-hidden rounded bg-[var(--bg-secondary)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={visibleUrl}
                alt="Előnézet"
                className="h-full w-full object-contain"
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Kattints vagy húzz ide új képet a lecseréléshez.
            </p>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
              {dragActive ? (
                <UploadCloud className="h-5 w-5 text-[var(--accent-gold)]" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
            </div>
            <p className="font-display text-sm uppercase tracking-[0.08em] text-[var(--text-primary)]">
              {dragActive ? "Engedd el a feltöltéshez" : "Húzd ide a képet"}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              vagy kattints a tallózáshoz · PNG / JPG / WEBP, max 8 MB
            </p>
          </>
        )}
      </div>

      {visibleUrl ? (
        <div className="flex items-center justify-between">
          <p className="truncate text-xs text-[var(--text-muted)]">
            {file?.name ?? "Jelenlegi kép"}
          </p>
          <AdminButton
            variant="ghost"
            size="sm"
            onClick={() => {
              if (file) onFileChange(null);
              else if (onRemoveExisting) onRemoveExisting();
            }}
          >
            <Trash2 className="h-4 w-4" />
            Eltávolítás
          </AdminButton>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-[var(--accent-red)]">{error}</p>
      ) : null}
    </div>
  );
}
