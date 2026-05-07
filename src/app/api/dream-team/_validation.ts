import type { DreamTeamFormation, DreamTeamPlayerSlot } from '@/types/database'

/**
 * Shared validation for the /api/dream-team endpoints.
 *
 * Kept colocated under the route folder (prefixed with `_` so the App Router
 * doesn't treat it as a route segment) because it has no other consumers.
 */

export const MAX_DREAM_TEAMS_PER_USER = 5
export const MAX_PLAYERS_PER_TEAM = 11

const ALLOWED_FORMATIONS: ReadonlySet<DreamTeamFormation> = new Set([
  '4-3-3',
  '4-2-3-1',
  '3-5-2',
  '4-4-2',
])

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DreamTeamPayload = {
  name?: string
  formation: DreamTeamFormation
  players?: DreamTeamPlayerSlot[]
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/**
 * Validate a POST/PUT body for the dream_teams table.
 *
 * `partial = true` is for PUT: every field is optional, but if present it
 * must be valid. At least one field must be supplied.
 *
 * `partial = false` is for POST: `formation` is required.
 */
export function validateDreamTeamPayload(
  body: unknown,
  options: { partial: boolean }
): ValidationResult<DreamTeamPayload> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Érvénytelen kérés' }
  }
  const candidate = body as Record<string, unknown>

  // ---- name ----
  let name: string | undefined
  if (candidate.name !== undefined) {
    if (typeof candidate.name !== 'string') {
      return { ok: false, error: 'A "name" mező szöveg kell legyen' }
    }
    const trimmed = candidate.name.trim()
    if (trimmed.length < 1 || trimmed.length > 100) {
      return {
        ok: false,
        error: 'A név hossza 1 és 100 karakter között kell legyen',
      }
    }
    name = trimmed
  }

  // ---- formation ----
  let formation: DreamTeamFormation | undefined
  if (candidate.formation !== undefined) {
    if (typeof candidate.formation !== 'string') {
      return { ok: false, error: 'A "formation" mező szöveg kell legyen' }
    }
    if (!ALLOWED_FORMATIONS.has(candidate.formation as DreamTeamFormation)) {
      return {
        ok: false,
        error: 'Érvénytelen formáció (megengedett: 4-3-3, 4-2-3-1, 3-5-2, 4-4-2)',
      }
    }
    formation = candidate.formation as DreamTeamFormation
  }

  if (!options.partial && !formation) {
    return { ok: false, error: 'A "formation" mező kötelező' }
  }

  // ---- players ----
  let players: DreamTeamPlayerSlot[] | undefined
  if (candidate.players !== undefined) {
    if (!Array.isArray(candidate.players)) {
      return { ok: false, error: 'A "players" mező tömb kell legyen' }
    }
    if (candidate.players.length > MAX_PLAYERS_PER_TEAM) {
      return {
        ok: false,
        error: `Maximum ${MAX_PLAYERS_PER_TEAM} játékos szerepelhet egy csapatban`,
      }
    }

    const seenPlayerIds = new Set<string>()
    const seenSlots = new Set<number>()
    const validated: DreamTeamPlayerSlot[] = []

    for (let i = 0; i < candidate.players.length; i++) {
      const slot = candidate.players[i]
      if (typeof slot !== 'object' || slot === null) {
        return { ok: false, error: `A players[${i}] elem érvénytelen` }
      }
      const slotObj = slot as Record<string, unknown>

      const slotIndex = slotObj.slotIndex
      if (
        typeof slotIndex !== 'number' ||
        !Number.isInteger(slotIndex) ||
        slotIndex < 0 ||
        slotIndex > 10
      ) {
        return {
          ok: false,
          error: `players[${i}].slotIndex egész szám kell legyen 0 és 10 között`,
        }
      }
      if (seenSlots.has(slotIndex)) {
        return {
          ok: false,
          error: `Duplikált slotIndex (${slotIndex}) a players tömbben`,
        }
      }
      seenSlots.add(slotIndex)

      const playerId = slotObj.playerId
      if (typeof playerId !== 'string' || !UUID_REGEX.test(playerId)) {
        return {
          ok: false,
          error: `players[${i}].playerId érvényes UUID kell legyen`,
        }
      }
      if (seenPlayerIds.has(playerId)) {
        return {
          ok: false,
          error: `Egy játékos csak egyszer szerepelhet a csapatban (${playerId})`,
        }
      }
      seenPlayerIds.add(playerId)

      const position = slotObj.position
      if (typeof position !== 'string' || position.trim().length === 0) {
        return {
          ok: false,
          error: `players[${i}].position nem lehet üres`,
        }
      }

      validated.push({
        slotIndex,
        playerId,
        position: position.trim(),
      })
    }

    players = validated
  }

  // ---- partial-mode: at least one field must be present ----
  if (options.partial && name === undefined && formation === undefined && players === undefined) {
    return {
      ok: false,
      error: 'Legalább egy mezőt meg kell adni (name, formation vagy players)',
    }
  }

  return {
    ok: true,
    value: {
      name,
      // For POST validateDreamTeamPayload guarantees `formation` is set.
      // For PUT it may be undefined; the caller decides what to do.
      formation: formation as DreamTeamFormation,
      players,
    },
  }
}
