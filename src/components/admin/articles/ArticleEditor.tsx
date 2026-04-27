"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from "@/lib/constants";
import type { Article } from "@/types/database";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminDialogBody,
  AdminDialogContent,
  AdminDialogFooter,
  AdminDialogHeader,
  AdminDialogRoot,
  AdminDialogTitle,
} from "@/components/admin/AdminDialog";
import { AdminField, AdminInput } from "@/components/admin/AdminInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { TiptapEditor } from "./TiptapEditor";

interface ArticleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided we're editing; when null we're creating a new article. */
  article: Article | null;
  onSaved: () => void;
}

interface FormState {
  title: string;
  category: ArticleCategory | "";
  content: string;
  imageFile: File | null;
  removeExistingImage: boolean;
}

const EMPTY_STATE: FormState = {
  title: "",
  category: "",
  content: "",
  imageFile: null,
  removeExistingImage: false,
};

export function ArticleEditor({
  open,
  onOpenChange,
  article,
  onSaved,
}: ArticleEditorProps) {
  const [state, setState] = useState<FormState>(EMPTY_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reset form whenever we toggle between create / edit modes. setState
  // calls are deferred via queueMicrotask to satisfy the
  // react-hooks/set-state-in-effect rule (React 19 + eslint-config-next).
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      if (article) {
        setState({
          title: article.title,
          category: (article.category as ArticleCategory) ?? "",
          content: article.content,
          imageFile: null,
          removeExistingImage: false,
        });
      } else {
        setState(EMPTY_STATE);
      }
      setErrors({});
      setServerError(null);
    });
  }, [open, article]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!state.title.trim()) next.title = "A cím kötelező";
    if (!state.category) next.category = "Válassz kategóriát";
    // strip HTML tags to assess emptiness
    const stripped = state.content.replace(/<[^>]*>/g, "").trim();
    if (!stripped) next.content = "A tartalom nem lehet üres";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const formData = new FormData();
    formData.append("title", state.title.trim());
    formData.append("content", state.content);
    formData.append("category", state.category);
    if (state.imageFile) {
      formData.append("image", state.imageFile);
    }

    const url = article ? `/api/articles/${article.id}` : "/api/articles";
    const method = article ? "PUT" : "POST";

    try {
      const response = await fetch(url, { method, body: formData });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `${response.status} ${response.statusText}`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Mentés sikertelen",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminDialogRoot open={open} onOpenChange={onOpenChange}>
      <AdminDialogContent open={open} size="lg">
        <form onSubmit={handleSubmit} noValidate>
          <AdminDialogHeader>
            <AdminDialogTitle>
              {article ? "Cikk szerkesztése" : "Új cikk"}
            </AdminDialogTitle>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              {article
                ? "Frissítsd a tartalmat. A módosítás azonnal élesedik."
                : "Új cikk létrehozása. Ne felejtsd el kiválasztani a kategóriát."}
            </p>
          </AdminDialogHeader>

          <AdminDialogBody className="space-y-5">
            <AdminField
              label="Cím"
              htmlFor="article-title"
              error={errors.title}
            >
              <AdminInput
                id="article-title"
                value={state.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Pl. Lewandowski mesterhármasa a Real ellen"
                maxLength={200}
                required
              />
            </AdminField>

            <AdminField
              label="Kategória"
              htmlFor="article-category"
              error={errors.category}
            >
              <AdminSelect
                id="article-category"
                value={state.category}
                onChange={(e) =>
                  update("category", e.target.value as ArticleCategory)
                }
              >
                <option value="" disabled>
                  Válassz kategóriát…
                </option>
                {ARTICLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ARTICLE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </AdminSelect>
            </AdminField>

            <AdminField label="Borítókép" hint="Opcionális · 16:9 ajánlott">
              <ImageDropzone
                file={state.imageFile}
                existingUrl={
                  state.removeExistingImage ? null : article?.image_url ?? null
                }
                onFileChange={(f) => update("imageFile", f)}
                onRemoveExisting={() => update("removeExistingImage", true)}
              />
            </AdminField>

            <AdminField label="Tartalom" error={errors.content}>
              <TiptapEditor
                value={state.content}
                onChange={(html) => update("content", html)}
              />
            </AdminField>

            {serverError ? (
              <div
                role="alert"
                className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]"
              >
                {serverError}
              </div>
            ) : null}
          </AdminDialogBody>

          <AdminDialogFooter>
            <AdminButton
              variant="subtle"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Mégse
            </AdminButton>
            <AdminButton
              variant="primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {article ? "Mentés" : "Létrehozás"}
            </AdminButton>
          </AdminDialogFooter>
        </form>
      </AdminDialogContent>
    </AdminDialogRoot>
  );
}
