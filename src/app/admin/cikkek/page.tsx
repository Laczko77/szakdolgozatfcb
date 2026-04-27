"use client";

import { useCallback, useEffect, useState } from "react";
import { Newspaper, Plus } from "lucide-react";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from "@/lib/constants";
import { fetchArticles } from "@/lib/articles-api";
import type { Article } from "@/types/database";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminCard,
  AdminCardHeader,
  AdminCardTitle,
} from "@/components/admin/AdminCard";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  AdminTableContainer,
  AdminTableEmpty,
  AdminTableSkeleton,
} from "@/components/admin/AdminTable";
import { Pagination } from "@/components/admin/Pagination";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ArticleEditor } from "@/components/admin/articles/ArticleEditor";
import { ArticlesTable } from "@/components/admin/articles/ArticlesTable";

const PAGE_SIZE = 20;

export default function AdminArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState<ArticleCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchArticles({
        page,
        limit: PAGE_SIZE,
        category: category === "all" ? undefined : category,
      });
      setArticles(result.articles);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hiba a betöltés során");
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  function handleNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function handleEdit(a: Article) {
    setEditing(a);
    setEditorOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/articles/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Törlés sikertelen");
      }
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Törlés sikertelen");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-gold)]">
            Tartalom
          </p>
          <h1 className="font-display text-3xl uppercase tracking-[0.04em] text-[var(--text-primary)] md:text-4xl">
            Cikkek
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {total} cikk a rendszerben.
          </p>
        </div>
        <AdminButton onClick={handleNew}>
          <Plus className="h-4 w-4" />
          Új cikk
        </AdminButton>
      </header>

      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Lista</AdminCardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Kategória
            </span>
            <div className="w-44">
              <AdminSelect
                value={category}
                onChange={(e) => {
                  setPage(1);
                  setCategory(e.target.value as ArticleCategory | "all");
                }}
              >
                <option value="all">Mind</option>
                {ARTICLE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {ARTICLE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </AdminSelect>
            </div>
          </div>
        </AdminCardHeader>

        <AdminTableContainer className="rounded-none border-x-0 border-b-0">
          {loading ? (
            <table className="w-full border-collapse text-sm">
              <AdminTableSkeleton columns={4} rows={6} />
            </table>
          ) : error ? (
            <AdminTableEmpty
              icon={<Newspaper className="h-5 w-5" />}
              title="Hiba történt"
              description={error}
              action={
                <AdminButton variant="secondary" onClick={() => void load()}>
                  Újra
                </AdminButton>
              }
            />
          ) : articles.length === 0 ? (
            <AdminTableEmpty
              icon={<Newspaper className="h-5 w-5" />}
              title="Nincs még cikk"
              description="Hozz létre egy újat a jobb felső gombbal."
              action={
                <AdminButton variant="secondary" onClick={handleNew}>
                  <Plus className="h-4 w-4" />
                  Új cikk
                </AdminButton>
              }
            />
          ) : (
            <ArticlesTable
              articles={articles}
              onEdit={handleEdit}
              onDelete={(a) => setDeleteTarget(a)}
            />
          )}
        </AdminTableContainer>

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalLabel={
            total > 0
              ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} / ${total}`
              : undefined
          }
        />
      </AdminCard>

      <ArticleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        article={editing}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Cikk törlése"
        description={
          <>
            Biztosan törölni szeretnéd a(z){" "}
            <strong className="text-[var(--text-primary)]">
              {deleteTarget?.title}
            </strong>{" "}
            cikket? Ez a művelet nem vonható vissza.
          </>
        }
        confirmLabel="Törlés"
        variant="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
