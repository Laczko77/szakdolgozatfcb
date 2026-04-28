"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { createUserPost } from "@/lib/social-api";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import type { EnrichedPost } from "@/types/social";

/**
 * F25.3 — user-facing post composer.
 *
 * Renders a click-to-expand glass card at the top of the community feed
 * for any authenticated user (admin and non-admin alike). Distinct from
 * `NewPostComposer` which calls /api/admin/posts and is admin-gated.
 *
 * UX shape:
 *   - Collapsed: avatar + read-only "Mit gondolsz?" prompt. One row tall.
 *   - Expanded: full textarea (max 2000 chars), live counter, drag-and-
 *     drop image dropzone with preview, Submit / Cancel actions.
 *
 * Form state runs on react-hook-form + zod for typesafe validation; the
 * image is handled in local state because RHF's File handling adds
 * unnecessary friction for a single optional file.
 */

const MAX_CONTENT = 2000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const schema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Üres posztot nem küldhetsz")
    .max(MAX_CONTENT, `Maximum ${MAX_CONTENT} karakter`),
});
type FormValues = z.infer<typeof schema>;

interface CreatePostFormProps {
  onPosted: (post: EnrichedPost) => void;
}

export function CreatePostForm({ onPosted }: CreatePostFormProps) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { content: "" },
    mode: "onChange",
  });

  const contentValue = watch("content") ?? "";
  const remaining = MAX_CONTENT - contentValue.length;

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) {
        setImage(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(null);
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("Csak képfájlt tölthetsz fel");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error("A kép maximum 5 MB lehet");
        return;
      }
      setImage(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
    },
    [preview, toast],
  );

  // Guests don't see the composer at all. Placed AFTER all hook calls
  // to satisfy the rules-of-hooks invariant.
  if (!user) return null;

  const handleExpand = () => {
    setExpanded(true);
    // Focus the textarea once it has mounted via AnimatePresence.
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleCollapse = () => {
    setExpanded(false);
    handleFile(null);
    reset({ content: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createUserPost({
        content: values.content.trim(),
        image,
      });
      onPosted(created);
      toast.success("Poszt közzétéve");
      handleCollapse();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Közzététel sikertelen",
      );
    }
  });

  // ── Drag & drop ──────────────────────────────────────────────────
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const username = profile?.username ?? "Szurkoló";
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <motion.form
      layout
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onDragOver={expanded ? onDragOver : undefined}
      onDragLeave={expanded ? onDragLeave : undefined}
      onDrop={expanded ? onDrop : undefined}
      className={cn(
        "glass-card relative flex flex-col gap-3 p-4 sm:p-5",
        "transition-colors duration-300",
        dragOver && "border-[var(--accent-gold)]/70 bg-[var(--accent-gold)]/[0.06]",
      )}
      aria-label="Új poszt írása"
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {dragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center",
              "rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--accent-gold)]",
              "bg-[var(--accent-gold)]/[0.08] backdrop-blur-sm",
              "z-10",
            )}
            aria-hidden
          >
            <span className="font-display text-sm uppercase tracking-[0.3em] text-[var(--accent-gold)]">
              Engedd el a képet
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start gap-3">
        <Avatar url={avatarUrl} name={username} size={42} />

        {/* Collapsed prompt or live textarea */}
        {!expanded ? (
          <button
            type="button"
            onClick={handleExpand}
            className={cn(
              "flex-1 rounded-[var(--radius-md)] px-4 py-3 text-left",
              "border border-[var(--glass-border)] bg-[var(--glass-bg)]/40",
              "text-sm text-[var(--text-muted)]",
              "transition-colors duration-200",
              "hover:border-[var(--accent-gold)]/40 hover:bg-[var(--glass-bg)]/60 hover:text-[var(--text-secondary)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
            )}
          >
            Mit gondolsz, {username}?
          </button>
        ) : (
          <div className="flex-1">
            <textarea
              {...register("content")}
              ref={(el) => {
                register("content").ref(el);
                textareaRef.current = el;
              }}
              maxLength={MAX_CONTENT + 100}
              rows={4}
              placeholder={`Mit gondolsz, ${username}?`}
              aria-invalid={errors.content ? "true" : "false"}
              aria-describedby={
                errors.content ? "create-post-content-error" : undefined
              }
              className={cn(
                "w-full resize-none bg-transparent",
                "text-[15px] leading-relaxed text-[var(--text-primary)]",
                "placeholder:text-[var(--text-muted)]",
                "focus:outline-none",
              )}
            />
            {errors.content && (
              <p
                id="create-post-content-error"
                className="mt-1 text-xs text-[var(--accent-red)]"
                role="alert"
              >
                {errors.content.message}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Image preview */}
      <AnimatePresence initial={false}>
        {expanded && preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative overflow-hidden rounded-xl border border-[var(--glass-border)]"
          >
            <span className="relative block aspect-[16/10] w-full bg-[var(--bg-secondary)]">
              <Image
                src={preview}
                alt="Előnézet"
                fill
                sizes="(min-width: 640px) 600px, 100vw"
                className="object-cover"
                unoptimized
              />
            </span>
            <button
              type="button"
              onClick={() => {
                handleFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              aria-label="Kép eltávolítása"
              className={cn(
                "absolute right-2 top-2 flex h-8 w-8 items-center justify-center",
                "rounded-full border border-white/20 bg-black/55 text-white",
                "backdrop-blur-md transition hover:bg-black/75",
              )}
            >
              <X size={14} aria-hidden />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      {/* Action bar — only when expanded */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex items-center gap-3 pt-1"
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Kép csatolása"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
                "border border-[var(--glass-border)] text-[var(--text-secondary)]",
                "hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
              )}
            >
              <ImagePlus size={15} aria-hidden />
            </button>

            <span
              className={cn(
                "font-display text-[11px] tabular-nums tracking-wider",
                remaining < 0
                  ? "text-[var(--accent-red)]"
                  : remaining < 100
                    ? "text-[var(--accent-gold)]"
                    : "text-[var(--text-muted)]",
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              {remaining}
            </span>

            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleCollapse}
                disabled={isSubmitting}
                className={cn(
                  "rounded-full px-4 py-2 text-xs",
                  "font-display uppercase tracking-[0.18em]",
                  "border border-[var(--glass-border)] bg-transparent",
                  "text-[var(--text-secondary)] transition",
                  "hover:border-[var(--glass-border-hover)] hover:text-[var(--text-primary)]",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                Mégse
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  contentValue.trim().length === 0 ||
                  contentValue.length > MAX_CONTENT
                }
                className={cn(
                  "glass-button-primary inline-flex items-center gap-2 px-5 py-2 text-xs",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                {isSubmitting ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden />
                ) : (
                  <Send size={13} aria-hidden />
                )}
                <span>{isSubmitting ? "Küldés…" : "Közzététel"}</span>
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}
