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
// Player positions
//
// Canonical ordering used by the public /api/players list. The football-data.org
// integration normalizes its raw position strings ("Goalkeeper" / "Defence" /
// "Midfield" / "Offence") to these canonical labels before persisting (see
// src/lib/football-data.ts).
// ----------------------------------------------------------------------------

export const PLAYER_POSITIONS = [
  'Goalkeeper',
  'Defender',
  'Midfielder',
  'Attacker',
] as const

export type PlayerPosition = (typeof PLAYER_POSITIONS)[number]

export function isPlayerPosition(value: unknown): value is PlayerPosition {
  return (
    typeof value === 'string' &&
    (PLAYER_POSITIONS as readonly string[]).includes(value)
  )
}

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
