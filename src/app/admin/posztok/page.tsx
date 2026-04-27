"use client";

/**
 * F15.7 — Admin: posztok és kommentek moderálása.
 *
 * - Poszt létrehozás: POST /api/admin/posts (multipart: content + image)
 * - Lista:            GET /api/posts
 * - Szerkesztés:      PUT /api/admin/posts/[id]
 * - Törlés:           DELETE /api/admin/posts/[id]
 * - Kommentek:        GET /api/posts/[id]/comments
 *                      DELETE /api/admin/comments/[id]
 */

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { MessageSquare, Pencil, Plus, Trash2, X, Inbox } from "lucide-react";

import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminCard,
  AdminCardBody,
  AdminCardHeader,
} from "@/components/admin/AdminCard";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogDescription,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "@/components/admin/AdminDialog";
import {
  AdminField,
  AdminTextarea,
} from "@/components/admin/AdminInput";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { adminFetch, adminFetchRaw, AdminApiError } from "@/lib/admin-fetch";
import type { Comment, Post } from "@/types/database";

type EnrichedPost = Post & {
  reactions: Record<string, number>;
  reactionTotal: number;
  commentCount: number;
};

type EnrichedComment = Comment & {
  reactions: Record<string, number>;
  reactionTotal: number;
};

const dateFormatter = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EnrichedPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<EnrichedPost | null>(null);
  const [moderating, setModerating] = useState<EnrichedPost | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadPosts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetchRaw<{ posts: EnrichedPost[] }>(
        "/api/posts?limit=50",
        { signal, cache: "no-store" },
      );
      if (signal?.aborted) return;
      setPosts(body.posts ?? []);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Ismeretlen hiba");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      void loadPosts(ac.signal);
    });
    return () => ac.abort();
  }, [loadPosts]);

  const handleDelete = async () => {
    if (!deletingPost) return;
    setDeleteBusy(true);
    try {
      await adminFetch(`/api/admin/posts/${deletingPost.id}`, {
        method: "DELETE",
      });
      setDeletingPost(null);
      await loadPosts();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Törlés sikertelen");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-[var(--text-primary)]">
            Posztok
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Hivatalos posztok létrehozása és kommentek moderálása.
          </p>
        </div>
        <AdminButton onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Új poszt
        </AdminButton>
      </header>

      {error ? (
        <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-2 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-[var(--text-muted)]">
          Betöltés…
        </p>
      ) : posts.length === 0 ? (
        <AdminCard>
          <AdminCardBody>
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--glass-border)] text-[var(--text-muted)]">
                <Inbox className="h-5 w-5" />
              </div>
              <p className="font-display text-lg uppercase tracking-[0.08em] text-[var(--text-primary)]">
                Még nincs poszt
              </p>
              <p className="max-w-md text-sm text-[var(--text-secondary)]">
                Hozz létre egy posztot, és megjelenik a közösségi feedben.
              </p>
            </div>
          </AdminCardBody>
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {posts.map((p) => (
            <AdminCard key={p.id} className="flex flex-col overflow-hidden">
              {p.image_url ? (
                <div className="relative aspect-video bg-[var(--bg-tertiary)]">
                  <Image
                    src={p.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              ) : null}
              <AdminCardHeader>
                <span className="text-xs text-[var(--text-secondary)]">
                  {formatDate(p.created_at)}
                </span>
                <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {p.reactionTotal} reakció · {p.commentCount} komment
                </span>
              </AdminCardHeader>
              <AdminCardBody className="flex-1">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">
                  {p.content}
                </p>
              </AdminCardBody>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--glass-border)] px-5 py-3">
                <AdminButton
                  variant="subtle"
                  size="sm"
                  onClick={() => setModerating(p)}
                >
                  <MessageSquare className="h-4 w-4" />
                  Kommentek
                  {p.commentCount > 0 ? ` (${p.commentCount})` : ""}
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditing(p)}
                  aria-label="Szerkesztés"
                >
                  <Pencil className="h-4 w-4" />
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeletingPost(p)}
                  aria-label="Törlés"
                  className="text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 hover:text-[var(--accent-red)]"
                >
                  <Trash2 className="h-4 w-4" />
                </AdminButton>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {creating ? (
        <PostFormDialog
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await loadPosts();
          }}
        />
      ) : null}
      {editing ? (
        <PostFormDialog
          mode="edit"
          post={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await loadPosts();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deletingPost !== null}
        onOpenChange={(open) => !open && setDeletingPost(null)}
        title="Poszt törlése"
        description="Biztos, hogy törlöd ezt a posztot? A kapcsolódó kommentek is törlődnek. Ez nem vonható vissza."
        confirmLabel="Törlés"
        loading={deleteBusy}
        onConfirm={handleDelete}
      />

      {moderating ? (
        <CommentsModerationDialog
          post={moderating}
          onClose={() => setModerating(null)}
          onChanged={loadPosts}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post create / edit form
// ---------------------------------------------------------------------------

interface PostFormProps {
  mode: "create" | "edit";
  post?: EnrichedPost;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function PostFormDialog({ mode, post, onClose, onSaved }: PostFormProps) {
  const [content, setContent] = useState(post?.content ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("A tartalom nem lehet üres");
      return;
    }
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("content", content);
    if (imageFile) formData.append("image", imageFile);

    try {
      if (mode === "create") {
        await adminFetch("/api/admin/posts", {
          method: "POST",
          body: formData,
        });
      } else if (post) {
        await adminFetch(`/api/admin/posts/${post.id}`, {
          method: "PUT",
          body: formData,
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mentés sikertelen");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDialogRoot open onOpenChange={(next) => (next ? null : onClose())}>
      <AdminDialogContent open size="lg">
        <AdminDialogHeader>
          <AdminDialogTitle>
            {mode === "create" ? "Új poszt" : "Poszt szerkesztése"}
          </AdminDialogTitle>
          <AdminDialogDescription>
            {mode === "create"
              ? "Hivatalos poszt a közösségi feedhez."
              : "Frissítsd a tartalmat vagy a képet."}
          </AdminDialogDescription>
        </AdminDialogHeader>
        <form onSubmit={handleSubmit}>
          <AdminDialogBody className="space-y-5">
            <AdminField label="Tartalom" htmlFor="content">
              <AdminTextarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                required
                placeholder="Mit szeretnél megosztani a szurkolókkal?"
              />
            </AdminField>
            <AdminField
              label={mode === "create" ? "Kép (opcionális)" : "Kép"}
            >
              <ImageDropzone
                file={imageFile}
                existingUrl={post?.image_url}
                onFileChange={setImageFile}
              />
            </AdminField>
            {error ? (
              <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
                {error}
              </div>
            ) : null}
          </AdminDialogBody>
          <AdminDialogFooter>
            <AdminButton
              type="button"
              variant="subtle"
              onClick={onClose}
              disabled={submitting}
            >
              Mégse
            </AdminButton>
            <AdminButton type="submit" loading={submitting}>
              {mode === "create" ? "Közzététel" : "Mentés"}
            </AdminButton>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}

// ---------------------------------------------------------------------------
// Comments moderation
// ---------------------------------------------------------------------------

interface ModerationProps {
  post: EnrichedPost;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}

function CommentsModerationDialog({
  post,
  onClose,
  onChanged,
}: ModerationProps) {
  const [comments, setComments] = useState<EnrichedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EnrichedComment | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const loadComments = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const body = await adminFetchRaw<{ comments: EnrichedComment[] }>(
          `/api/posts/${post.id}/comments`,
          { signal, cache: "no-store" },
        );
        if (signal?.aborted) return;
        setComments(body.comments ?? []);
      } catch (err) {
        if (signal?.aborted) return;
        setError(err instanceof Error ? err.message : "Ismeretlen hiba");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [post.id],
  );

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      void loadComments(ac.signal);
    });
    return () => ac.abort();
  }, [loadComments]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/comments/${confirmDelete.id}`, {
        method: "DELETE",
      });
      setConfirmDelete(null);
      await loadComments();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Törlés sikertelen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminDialogRoot open onOpenChange={(next) => (next ? null : onClose())}>
        <AdminDialogContent open size="lg">
          <AdminDialogHeader>
            <AdminDialogTitle>Kommentek moderálása</AdminDialogTitle>
            <AdminDialogDescription className="line-clamp-2">
              {post.content}
            </AdminDialogDescription>
          </AdminDialogHeader>
          <AdminDialogBody className="space-y-3">
            {error ? (
              <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
                {error}
              </div>
            ) : null}
            {loading ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                Betöltés…
              </p>
            ) : comments.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                Ehhez a poszthoz még nincs komment.
              </p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {comments.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)] p-3"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                        <span className="font-mono">
                          {c.user_id.slice(0, 8)}
                        </span>
                        <span>·</span>
                        <span>{formatDate(c.created_at)}</span>
                        {c.reactionTotal > 0 ? (
                          <>
                            <span>·</span>
                            <span>{c.reactionTotal} reakció</span>
                          </>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-primary)]">
                        {c.content}
                      </p>
                    </div>
                    <AdminButton
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(c)}
                      aria-label="Komment törlése"
                      className="text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10 hover:text-[var(--accent-red)]"
                    >
                      <X className="h-4 w-4" />
                    </AdminButton>
                  </li>
                ))}
              </ul>
            )}
          </AdminDialogBody>
          <AdminDialogFooter>
            <AdminButton variant="subtle" onClick={onClose}>
              Bezárás
            </AdminButton>
          </AdminDialogFooter>
        </AdminDialogContent>
      </AdminDialogRoot>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="Komment törlése"
        description="Biztosan törlöd ezt a kommentet?"
        confirmLabel="Törlés"
        loading={busy}
        onConfirm={handleDelete}
      />
    </>
  );
}
