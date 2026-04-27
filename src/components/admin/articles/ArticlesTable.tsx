"use client";

import { Pencil, Trash2 } from "lucide-react";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
} from "@/lib/constants";
import type { Article } from "@/types/database";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminButton } from "@/components/admin/AdminButton";
import {
  AdminTable,
  AdminTBody,
  AdminTD,
  AdminTH,
  AdminTHead,
  AdminTR,
} from "@/components/admin/AdminTable";

interface ArticlesTableProps {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (article: Article) => void;
}

const HU_DATE_FMT = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function isKnownCategory(c: string | null): c is ArticleCategory {
  return c !== null && (ARTICLE_CATEGORIES as readonly string[]).includes(c);
}

export function ArticlesTable({
  articles,
  onEdit,
  onDelete,
}: ArticlesTableProps) {
  return (
    <AdminTable>
      <AdminTHead>
        <tr>
          <AdminTH className="w-[44%]">Cím</AdminTH>
          <AdminTH className="w-[18%]">Kategória</AdminTH>
          <AdminTH className="w-[18%]">Dátum</AdminTH>
          <AdminTH className="w-[20%] text-right">Műveletek</AdminTH>
        </tr>
      </AdminTHead>
      <AdminTBody>
        {articles.map((a) => (
          <AdminTR key={a.id}>
            <AdminTD>
              <div className="flex items-center gap-3">
                {a.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.image_url}
                    alt=""
                    className="h-10 w-14 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-14 shrink-0 rounded bg-[var(--bg-tertiary)]/40" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--text-primary)]">
                    {a.title}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {a.id.slice(0, 8)}
                  </p>
                </div>
              </div>
            </AdminTD>
            <AdminTD>
              <AdminBadge tone={isKnownCategory(a.category) ? "info" : "neutral"}>
                {isKnownCategory(a.category)
                  ? ARTICLE_CATEGORY_LABELS[a.category]
                  : (a.category ?? "Nincs")}
              </AdminBadge>
            </AdminTD>
            <AdminTD>
              <span className="text-sm text-[var(--text-secondary)]">
                {HU_DATE_FMT.format(new Date(a.created_at))}
              </span>
            </AdminTD>
            <AdminTD className="text-right">
              <div className="inline-flex items-center gap-1.5">
                <AdminButton
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(a)}
                  aria-label={`Szerkesztés: ${a.title}`}
                >
                  <Pencil className="h-4 w-4" />
                </AdminButton>
                <AdminButton
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(a)}
                  aria-label={`Törlés: ${a.title}`}
                  className="text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10"
                >
                  <Trash2 className="h-4 w-4" />
                </AdminButton>
              </div>
            </AdminTD>
          </AdminTR>
        ))}
      </AdminTBody>
    </AdminTable>
  );
}
