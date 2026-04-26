/**
 * Frontend client for the F6 news endpoints.
 *
 * Mirrors the shape of `lib/shop-api.ts` — every function throws on
 * non-2xx with the server-provided error message so callers can `catch`
 * and surface it via the toast system.
 *
 * Server routes:
 *   GET /api/articles?page=&limit=&category=
 *   GET /api/articles/[id]
 */

import type { Article } from "@/types/database";
import type { ArticleCategory } from "@/lib/constants";

export interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  totalPages: number;
}

interface FetchArticlesParams {
  page?: number;
  limit?: number;
  category?: ArticleCategory | string;
  signal?: AbortSignal;
}

/**
 * Build a query string only for the params that are actually set.
 *
 * The server tolerates missing params (defaults to page=1, limit=10),
 * but we still want a clean URL — so we omit empties rather than
 * sending `category=` and forcing the server to validate ''.
 */
function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // Fall through to status text.
  }
  return `${response.status} ${response.statusText}`;
}

export async function fetchArticles(
  params: FetchArticlesParams = {},
): Promise<ArticleListResponse> {
  const url = `/api/articles${buildQuery({
    page: params.page,
    limit: params.limit,
    category: params.category,
  })}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: params.signal,
    // News list updates relatively often (admin posts) — bypass the
    // browser HTTP cache so users always see fresh content.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as ArticleListResponse;
}

export async function fetchArticle(
  id: string,
  init?: { signal?: AbortSignal },
): Promise<Article> {
  const response = await fetch(`/api/articles/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: init?.signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as Article;
}
