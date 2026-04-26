import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import {
  ApiFootballConfigError,
  fetchBarcaPlayers,
  type PlayerApiResponse,
  type PlayerApiStatistics,
} from '@/lib/api-football'
import { uploadFile } from '@/lib/storage'
import { FCB_TEAM_ID, STORAGE_BUCKETS } from '@/lib/constants'
import type { Json, TablesInsert } from '@/types/database'

/**
 * POST /api/admin/players/sync
 *
 * Admin-triggered job: pulls the current FC Barcelona squad from API-Football
 * for a given season and upserts every player into `public.players`.
 *
 * Conflict resolution: `api_football_id` (UNIQUE in schema). On re-run we
 * overwrite name/position/number/image_url/stats/season, but we DO NOT touch
 * `bio` — that field is owned by the admin manual editor (Task 4.3).
 *
 * Photo handling: API-Football serves player photos from their own CDN. We
 * mirror them into the `player-images` bucket so we (a) survive their CDN
 * outages and (b) don't leak referrer traffic. Re-uploading is skipped when
 * the existing `image_url` already points at our Supabase project.
 *
 * Body: `{ season?: number }`. Default season = current calendar year if we
 * are past July, otherwise previous year (UEFA seasons span autumn → spring).
 */

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  // ---- Parse body -----------------------------------------------------------
  let season: number = defaultSeason()
  try {
    const text = await request.text()
    if (text.trim().length > 0) {
      const parsed: unknown = JSON.parse(text)
      if (
        parsed &&
        typeof parsed === 'object' &&
        'season' in parsed &&
        typeof (parsed as { season?: unknown }).season === 'number'
      ) {
        const candidate = (parsed as { season: number }).season
        if (Number.isInteger(candidate) && candidate >= 2000 && candidate <= 2100) {
          season = candidate
        }
      }
    }
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  // ---- Fetch from API-Football ---------------------------------------------
  let apiPlayers: PlayerApiResponse[]
  try {
    apiPlayers = await fetchBarcaPlayers(season)
  } catch (err) {
    if (err instanceof ApiFootballConfigError) {
      return errorResponse(
        'Az API-Football kulcs nincs beállítva (API_FOOTBALL_KEY)',
        503
      )
    }
    return errorResponse(
      err instanceof Error
        ? `API-Football hiba: ${err.message}`
        : 'API-Football hiba',
      502
    )
  }

  if (apiPlayers.length === 0) {
    return successResponse({ synced: 0, errors: [], season })
  }

  // ---- Look up existing rows so we know which photos to (re)upload ---------
  const supabase = createServiceRoleClient()
  const apiIds = apiPlayers.map((p) => p.player.id)

  type ExistingRow = {
    api_football_id: number | null
    image_url: string | null
  }
  const { data: existingRaw, error: fetchError } = await supabase
    .from('players')
    .select('api_football_id, image_url')
    .in('api_football_id', apiIds)

  if (fetchError) {
    return errorResponse(
      `Meglévő játékosok lekérése sikertelen: ${fetchError.message}`,
      500
    )
  }

  const existingByApiId = new Map<number, ExistingRow>()
  for (const row of (existingRaw ?? []) as ExistingRow[]) {
    if (row.api_football_id !== null) {
      existingByApiId.set(row.api_football_id, row)
    }
  }

  // ---- Process each player --------------------------------------------------
  const errors: string[] = []
  let synced = 0

  for (const item of apiPlayers) {
    const apiPlayer = item.player

    try {
      // Pick the FC Barcelona statistics block (an aggregated row may include
      // entries for the national team or previous clubs in the same season).
      const fcbStats =
        item.statistics.find((s) => s.team.id === FCB_TEAM_ID) ??
        item.statistics[0] ??
        null

      const existing = existingByApiId.get(apiPlayer.id) ?? null
      const imageUrl = await resolveImageUrl(
        apiPlayer.photo,
        existing?.image_url ?? null,
        apiPlayer.id
      )

      const insert: TablesInsert<'players'> = {
        api_football_id: apiPlayer.id,
        name: apiPlayer.name,
        position: fcbStats?.games.position ?? null,
        number: fcbStats?.games.number ?? null,
        image_url: imageUrl,
        bio: null, // intentionally omitted from update set below
        stats: buildStatsJson(fcbStats),
        season,
        updated_at: new Date().toISOString(),
      }

      // Upsert by api_football_id. We must NOT overwrite `bio` on conflict —
      // PostgREST's `onConflict` upsert overwrites all supplied columns by
      // default, so we omit `bio` from the insert when the row already exists
      // and use ignoreDuplicates: false (i.e. UPDATE on conflict).
      const payload: TablesInsert<'players'> = existing
        ? // existing row: don't touch bio
          (() => {
            const { bio: _bio, ...rest } = insert
            void _bio
            return rest as TablesInsert<'players'>
          })()
        : insert

      const { error: upsertError } = await supabase
        .from('players')
        .upsert(payload as never, {
          onConflict: 'api_football_id',
          ignoreDuplicates: false,
        })

      if (upsertError) {
        errors.push(
          `Játékos #${apiPlayer.id} (${apiPlayer.name}): ${upsertError.message}`
        )
        continue
      }

      synced += 1
    } catch (err) {
      errors.push(
        `Játékos #${apiPlayer.id} (${apiPlayer.name}): ${
          err instanceof Error ? err.message : 'ismeretlen hiba'
        }`
      )
    }
  }

  return successResponse({ synced, errors, season })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Default to the current UEFA season. Their seasons run autumn → spring, so
 * "season=2024" covers Aug-2024 → May-2025. Cutoff at July 1st.
 */
function defaultSeason(): number {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() + 1 // 1-12
  return month >= 7 ? year : year - 1
}

/**
 * Decide whether to mirror the API-Football photo into our bucket.
 *
 * - If the existing image_url already points at our Supabase project, keep it.
 * - Otherwise, download the API-Football photo and upload it. The new public
 *   URL is returned.
 * - On any failure (no photo, network error, upload error) we fall back to
 *   the original API-Football URL so the player row still has *something*.
 */
async function resolveImageUrl(
  apiPhotoUrl: string | null,
  existingImageUrl: string | null,
  apiPlayerId: number
): Promise<string | null> {
  if (existingImageUrl && isOurStorageUrl(existingImageUrl)) {
    return existingImageUrl
  }
  if (!apiPhotoUrl) return existingImageUrl ?? null

  try {
    const res = await fetch(apiPhotoUrl, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(
        `[players/sync] Photo download failed (${res.status}) for player ${apiPlayerId}`
      )
      return apiPhotoUrl
    }

    const contentType = res.headers.get('content-type') ?? 'image/png'
    const arrayBuffer = await res.arrayBuffer()
    const ext = extensionFromContentType(contentType)
    const fileName = `player-${apiPlayerId}.${ext}`
    const file = new File([arrayBuffer], fileName, { type: contentType })

    return await uploadFile(STORAGE_BUCKETS.playerImages, file)
  } catch (err) {
    console.warn(
      `[players/sync] Photo mirror failed for player ${apiPlayerId}:`,
      err instanceof Error ? err.message : err
    )
    return apiPhotoUrl
  }
}

function isOurStorageUrl(url: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return false
  try {
    const parsed = new URL(url)
    const ours = new URL(supabaseUrl)
    return parsed.host === ours.host
  } catch {
    return false
  }
}

function extensionFromContentType(ct: string): string {
  const lower = ct.toLowerCase()
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg'
  if (lower.includes('png')) return 'png'
  if (lower.includes('webp')) return 'webp'
  if (lower.includes('gif')) return 'gif'
  return 'png'
}

/**
 * Compact, frontend-friendly stats payload. Nullables are coerced to 0 so
 * the UI can render numbers without defensive guards.
 */
function buildStatsJson(stats: PlayerApiStatistics | null): Json {
  if (!stats) {
    return {
      goals: 0,
      assists: 0,
      appearances: 0,
      minutes: 0,
      yellow_cards: 0,
      red_cards: 0,
    }
  }
  return {
    goals: stats.goals.total ?? 0,
    assists: stats.goals.assists ?? 0,
    appearances: stats.games.appearences ?? 0,
    minutes: stats.games.minutes ?? 0,
    yellow_cards: stats.cards.yellow ?? 0,
    red_cards: stats.cards.red ?? 0,
  }
}
