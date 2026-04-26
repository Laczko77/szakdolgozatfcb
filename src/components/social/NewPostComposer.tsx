"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ImagePlus, X } from "lucide-react";
import { createAdminPost } from "@/lib/social-api";
import { useToast } from "@/providers/ToastProvider";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import type { EnrichedPost } from "@/types/social";

/**
 * Admin-only composer pinned at the top of the feed.
 *
 * Only renders for `profile.role === 'admin'` — the parent gates this,
 * but we double-check so a stale prop never leaks the field. Posts go
 * out via multipart/form-data to /api/admin/posts; on success the
 * parent prepends the returned row to the timeline.
 */
interface NewPostComposerProps {
  onPosted: (post: EnrichedPost) => void;
}

const MAX_CONTENT = 1000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export function NewPostComposer({ onPosted }: NewPostComposerProps) {
  const { profile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

  if (!profile || profile.role !== "admin") return null;

  const handleFile = (file: File | null) => {
    if (!file) {
      setImage(null);
      setPreview(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("A kép maximum 5 MB lehet");
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const reset = () => {
    setContent("");
    handleFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = content.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const created = await createAdminPost({ content: value, image });
      onPosted(created);
      reset();
      toast.success("Poszt közzétéve");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Közzététel sikertelen",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = MAX_CONTENT - content.length;

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      onSubmit={handleSubmit}
      className={cn(
        "glass-card-strong",
        "flex flex-col gap-3 p-4 sm:p-5",
        "transition-colors duration-300",
        focused && "border-[var(--accent-gold)]",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          url={profile.avatar_url}
          name={profile.username ?? "Admin"}
          size={42}
        />
        <textarea
          value={content}
          onChange={(e) =>
            setContent(e.target.value.slice(0, MAX_CONTENT))
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Mi újság a klubnál?"
          rows={2}
          className="flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          aria-label="Poszt szöveg"
        />
      </div>

      {preview && (
        <div className="relative overflow-hidden rounded-xl border border-[var(--glass-border)]">
          <span className="block aspect-[16/10] w-full">
            <Image
              src={preview}
              alt="Előnézet"
              fill
              sizes="600px"
              className="object-cover"
              unoptimized
            />
          </span>
          <button
            type="button"
            onClick={() => handleFile(null)}
            aria-label="Kép eltávolítása"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md transition hover:bg-black/75"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Kép csatolása"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-full transition",
            "border border-[var(--glass-border)] text-[var(--text-secondary)]",
            "hover:border-[var(--accent-gold)] hover:text-[var(--accent-gold)]",
          )}
        >
          <ImagePlus size={15} aria-hidden />
        </button>

        <span
          className={cn(
            "text-[11px] tabular-nums",
            remaining < 100
              ? "text-[var(--accent-red)]"
              : "text-[var(--text-muted)]",
          )}
          aria-live="polite"
        >
          {remaining}
        </span>

        <button
          type="submit"
          disabled={submitting || content.trim().length === 0}
          className="glass-button-primary ml-auto px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Küldés…" : "Közzététel"}
        </button>
      </div>
    </motion.form>
  );
}
