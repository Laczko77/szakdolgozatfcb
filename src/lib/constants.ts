/**
 * Project-wide constants.
 *
 * Single source of truth for category enums, labels, and external IDs.
 * Anything that the frontend AND backend both consume should live here.
 */

// ----------------------------------------------------------------------------
// Article categories
// ----------------------------------------------------------------------------

export const ARTICLE_CATEGORIES = [
  'transfers',
  'match-report',
  'interview',
  'news',
  'opinion',
] as const

export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  transfers: 'Átigazolások',
  'match-report': 'Meccsösszefoglalók',
  interview: 'Interjúk',
  news: 'Hírek',
  opinion: 'Vélemény',
}

/**
 * Type guard: narrows `unknown` to a valid ArticleCategory.
 * Use to validate FormData / query-string input before persisting.
 */
export function isArticleCategory(value: unknown): value is ArticleCategory {
  return (
    typeof value === 'string' &&
    (ARTICLE_CATEGORIES as readonly string[]).includes(value)
  )
}

// ----------------------------------------------------------------------------
// API-Football
// ----------------------------------------------------------------------------

/** FC Barcelona team ID in the API-Football (api-sports.io) dataset. */
export const FCB_TEAM_ID = 529

// ----------------------------------------------------------------------------
// Storage buckets — keep in sync with supabase/migrations/001_storage_buckets.sql
// ----------------------------------------------------------------------------

export const STORAGE_BUCKETS = {
  profileImages: 'profile-images',
  articleImages: 'article-images',
  playerImages: 'player-images',
  productImages: 'product-images',
  postImages: 'post-images',
} as const

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS]
