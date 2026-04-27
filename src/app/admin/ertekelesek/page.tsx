"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
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
import {
  ReviewsTable,
  type AdminReview,
} from "@/components/admin/reviews/ReviewsTable";

const PAGE_SIZE = 20;
type Filter = "all" | "visible" | "hidden";

interface ReviewsListResponse {
  reviews: AdminReview[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(PAGE_SIZE));
        if (filter !== "all") params.set("visibility", filter);

        const response = await fetch(
          `/api/admin/reviews?${params.toString()}`,
          { cache: "no-store", signal },
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Értékelések lekérése sikertelen");
        }
        const data = (await response.json()) as ReviewsListResponse;
        if (signal.aborted) return;
        setReviews(data.reviews);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } catch (err) {
        if (signal.aborted) return;
        setError(err instanceof Error ? err.message : "Hiba a betöltés során");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [page, filter],
  );

  useEffect(() => {
    const ac = new AbortController();
    queueMicrotask(() => {
      void load(ac.signal);
    });
    return () => ac.abort();
  }, [load]);

  const reload = useCallback(() => {
    const ac = new AbortController();
    void load(ac.signal);
  }, [load]);

  async function handleToggleVisibility(review: AdminReview) {
    setPendingId(review.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !review.is_visible }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Művelet sikertelen");
      }

      // Local optimistic patch — also re-fetch when filter is non-"all"
      // since the row may need to disappear from the list.
      if (filter === "all") {
        setReviews((current) =>
          current.map((r) =>
            r.id === review.id ? { ...r, is_visible: !r.is_visible } : r,
          ),
        );
      } else {
        reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Művelet sikertelen");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-gold)]">
          Moderálás
        </p>
        <h1 className="font-display text-3xl uppercase tracking-[0.04em] text-[var(--text-primary)] md:text-4xl">
          Értékelések
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {total} értékelés a rendszerben. Rejtsd el a nem megfelelőeket.
        </p>
      </header>

      <AdminCard>
        <AdminCardHeader>
          <AdminCardTitle>Lista</AdminCardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Láthatóság
            </span>
            <div className="w-44">
              <AdminSelect
                value={filter}
                onChange={(e) => {
                  setPage(1);
                  setFilter(e.target.value as Filter);
                }}
              >
                <option value="all">Összes</option>
                <option value="visible">Csak láthatóak</option>
                <option value="hidden">Csak rejtettek</option>
              </AdminSelect>
            </div>
          </div>
        </AdminCardHeader>

        <AdminTableContainer className="rounded-none border-x-0 border-b-0">
          {loading ? (
            <table className="w-full border-collapse text-sm">
              <AdminTableSkeleton columns={6} rows={6} />
            </table>
          ) : error ? (
            <AdminTableEmpty
              icon={<Star className="h-5 w-5" />}
              title="Hiba történt"
              description={error}
              action={
                <AdminButton variant="secondary" onClick={reload}>
                  Újra
                </AdminButton>
              }
            />
          ) : reviews.length === 0 ? (
            <AdminTableEmpty
              icon={<Star className="h-5 w-5" />}
              title="Nincs értékelés"
              description={
                filter === "hidden"
                  ? "Jelenleg nincs rejtett értékelés."
                  : filter === "visible"
                    ? "Jelenleg nincs látható értékelés."
                    : "A vásárlók még nem írtak értékelést."
              }
            />
          ) : (
            <ReviewsTable
              reviews={reviews}
              pendingId={pendingId}
              onToggleVisibility={handleToggleVisibility}
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
    </div>
  );
}
