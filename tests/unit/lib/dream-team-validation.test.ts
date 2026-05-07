import { describe, it, expect } from 'vitest'
import {
  validateDreamTeamPayload,
  MAX_DREAM_TEAMS_PER_USER,
  MAX_PLAYERS_PER_TEAM,
} from '@/app/api/dream-team/_validation'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function uuid(n = 0): string {
  return `550e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, '0')}`
}

function validSlot(slotIndex: number, n = 0) {
  return { slotIndex, playerId: uuid(n), position: 'Defender' }
}

// Shorthand wrappers
const post = (body: unknown) => validateDreamTeamPayload(body, { partial: false })
const put  = (body: unknown) => validateDreamTeamPayload(body, { partial: true })

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('constants', () => {
  it('MAX_DREAM_TEAMS_PER_USER is 5', () => {
    expect(MAX_DREAM_TEAMS_PER_USER).toBe(5)
  })

  it('MAX_PLAYERS_PER_TEAM is 11', () => {
    expect(MAX_PLAYERS_PER_TEAM).toBe(11)
  })
})

// ---------------------------------------------------------------------------
// Body-level type validation (POST mode)
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — body type errors', () => {
  it('returns error for null body', () => {
    const result = post(null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Érvénytelen kérés')
  })

  it('returns error for string body', () => {
    const result = post('string')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Érvénytelen kérés')
  })

  it('returns error for number body', () => {
    const result = post(42)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Érvénytelen kérés')
  })

  it('returns error for array body', () => {
    const result = post([])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Érvénytelen kérés')
  })

  it('returns error for boolean body', () => {
    const result = post(true)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Érvénytelen kérés')
  })
})

// ---------------------------------------------------------------------------
// formation field — POST mode
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — formation (POST, partial: false)', () => {
  it('returns error when formation is missing', () => {
    const result = post({})
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "formation" mező kötelező')
  })

  it('returns error when formation is a number', () => {
    const result = post({ formation: 123 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "formation" mező szöveg kell legyen')
  })

  it('returns error when formation is not in the allowed set', () => {
    const result = post({ formation: '4-4-4' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe(
        'Érvénytelen formáció (megengedett: 4-3-3, 4-2-3-1, 3-5-2, 4-4-2)'
      )
  })

  it('returns error when formation is an empty string', () => {
    const result = post({ formation: '' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe(
        'Érvénytelen formáció (megengedett: 4-3-3, 4-2-3-1, 3-5-2, 4-4-2)'
      )
  })

  it('returns error when formation is null', () => {
    const result = post({ formation: null })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "formation" mező szöveg kell legyen')
  })

  it('accepts formation "4-3-3"', () => {
    const result = post({ formation: '4-3-3' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.formation).toBe('4-3-3')
  })

  it('accepts formation "4-2-3-1"', () => {
    const result = post({ formation: '4-2-3-1' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.formation).toBe('4-2-3-1')
  })

  it('accepts formation "3-5-2"', () => {
    const result = post({ formation: '3-5-2' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.formation).toBe('3-5-2')
  })

  it('accepts formation "4-4-2"', () => {
    const result = post({ formation: '4-4-2' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.formation).toBe('4-4-2')
  })
})

// ---------------------------------------------------------------------------
// formation field — PUT mode
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — formation (PUT, partial: true)', () => {
  it('does not require formation in partial mode when another field is present', () => {
    const result = put({ name: 'My Team' })
    expect(result.ok).toBe(true)
  })

  it('returns error for invalid formation even in partial mode', () => {
    const result = put({ formation: '5-5-5' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe(
        'Érvénytelen formáció (megengedett: 4-3-3, 4-2-3-1, 3-5-2, 4-4-2)'
      )
  })

  it('accepts valid formation in partial mode', () => {
    const result = put({ formation: '4-4-2' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.formation).toBe('4-4-2')
  })
})

// ---------------------------------------------------------------------------
// name field
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — name field', () => {
  it('returns error when name is a number', () => {
    const result = post({ formation: '4-3-3', name: 123 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "name" mező szöveg kell legyen')
  })

  it('returns error when name is an empty string', () => {
    const result = post({ formation: '4-3-3', name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('A név hossza 1 és 100 karakter között kell legyen')
  })

  it('returns error when name is only whitespace', () => {
    const result = post({ formation: '4-3-3', name: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('A név hossza 1 és 100 karakter között kell legyen')
  })

  it('returns error when name exceeds 100 characters after trim', () => {
    const result = post({ formation: '4-3-3', name: 'a'.repeat(101) })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('A név hossza 1 és 100 karakter között kell legyen')
  })

  it('accepts name of exactly 100 characters', () => {
    const result = post({ formation: '4-3-3', name: 'a'.repeat(100) })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('a'.repeat(100))
  })

  it('accepts name of exactly 1 character', () => {
    const result = post({ formation: '4-3-3', name: 'X' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('X')
  })

  it('trims surrounding whitespace from name', () => {
    const result = post({ formation: '4-3-3', name: '  My Team  ' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('My Team')
  })

  it('omits name from result when not provided', () => {
    const result = post({ formation: '4-3-3' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBeUndefined()
  })

  it('returns error when name is null', () => {
    const result = post({ formation: '4-3-3', name: null })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "name" mező szöveg kell legyen')
  })

  it('returns error when name is a boolean', () => {
    const result = post({ formation: '4-3-3', name: false })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "name" mező szöveg kell legyen')
  })
})

// ---------------------------------------------------------------------------
// players field — structural validation
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — players field structure', () => {
  it('returns error when players is a string', () => {
    const result = post({ formation: '4-3-3', players: 'not-array' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "players" mező tömb kell legyen')
  })

  it('returns error when players is a plain object', () => {
    const result = post({ formation: '4-3-3', players: {} })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "players" mező tömb kell legyen')
  })

  it('accepts an empty players array', () => {
    const result = post({ formation: '4-3-3', players: [] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.players).toEqual([])
  })

  it('returns error when players has 12 elements (> 11)', () => {
    const players = Array.from({ length: 12 }, (_, i) => validSlot(i, i))
    const result = post({ formation: '4-3-3', players })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('Maximum 11 játékos szerepelhet egy csapatban')
  })

  it('accepts exactly 11 players', () => {
    const players = Array.from({ length: 11 }, (_, i) => validSlot(i, i))
    const result = post({ formation: '4-3-3', players })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.players).toHaveLength(11)
  })

  it('returns error when a slot element is null', () => {
    const result = post({ formation: '4-3-3', players: [null] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('players[0]')
  })

  it('returns error when a slot element is a primitive', () => {
    const result = post({ formation: '4-3-3', players: [42] })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('players[0]')
  })

  it('omits players from result when not provided', () => {
    const result = post({ formation: '4-3-3' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.players).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// players — slotIndex validation
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — players[].slotIndex', () => {
  it('returns error when slotIndex is missing', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('slotIndex')
  })

  it('returns error when slotIndex is a string', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: '0', playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('slotIndex')
  })

  it('returns error when slotIndex is negative (-1)', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: -1, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('slotIndex')
  })

  it('returns error when slotIndex is 11 (> 10)', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 11, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('slotIndex')
  })

  it('returns error when slotIndex is a float (1.5)', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 1.5, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('slotIndex')
  })

  it('accepts slotIndex 0 (lower boundary)', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(true)
  })

  it('accepts slotIndex 10 (upper boundary)', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 10, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(true)
  })

  it('returns error for duplicate slotIndex', () => {
    const result = post({
      formation: '4-3-3',
      players: [
        { slotIndex: 0, playerId: uuid(0), position: 'GK' },
        { slotIndex: 0, playerId: uuid(1), position: 'CB' },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Duplikált slotIndex (0) a players tömbben')
  })

  it('returns error for NaN slotIndex', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: NaN, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('slotIndex')
  })
})

// ---------------------------------------------------------------------------
// players — playerId validation
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — players[].playerId', () => {
  it('returns error when playerId is not a string', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: 123, position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('playerId')
  })

  it('returns error when playerId is not a valid UUID', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: 'nem-uuid', position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('playerId')
  })

  it('returns error when playerId is an empty string', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: '', position: 'GK' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('playerId')
  })

  it('accepts a valid UUID v4 playerId', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.players![0].playerId).toBe(uuid(0))
  })

  it('accepts a UUID with uppercase hex digits', () => {
    const uppercaseUuid = '550E8400-E29B-41D4-A716-446655440000'
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uppercaseUuid, position: 'GK' }],
    })
    expect(result.ok).toBe(true)
  })

  it('returns error for duplicate playerId across different slots', () => {
    const id = uuid(0)
    const result = post({
      formation: '4-3-3',
      players: [
        { slotIndex: 0, playerId: id, position: 'GK' },
        { slotIndex: 1, playerId: id, position: 'CB' },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('csak egyszer szerepelhet')
  })
})

// ---------------------------------------------------------------------------
// players — position validation
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — players[].position', () => {
  it('returns error when position is missing', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0) }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('position')
  })

  it('returns error when position is an empty string', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0), position: '' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('position')
  })

  it('returns error when position is only whitespace', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0), position: '   ' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('position')
  })

  it('returns error when position is a number', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0), position: 99 }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('position')
  })

  it('trims surrounding whitespace from position', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0), position: ' Midfielder ' }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.players![0].position).toBe('Midfielder')
  })

  it('preserves valid position without whitespace', () => {
    const result = post({
      formation: '4-3-3',
      players: [{ slotIndex: 0, playerId: uuid(0), position: 'GK' }],
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.players![0].position).toBe('GK')
  })
})

// ---------------------------------------------------------------------------
// Full valid payload with multiple players
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — valid full payload', () => {
  it('returns ok with 3 valid players and all fields populated', () => {
    const players = [
      { slotIndex: 0, playerId: uuid(0), position: ' GK ' },
      { slotIndex: 1, playerId: uuid(1), position: 'CB' },
      { slotIndex: 2, playerId: uuid(2), position: ' LB ' },
    ]
    const result = post({
      formation: '4-3-3',
      name: '  My Dream Team  ',
      players,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.formation).toBe('4-3-3')
      expect(result.value.name).toBe('My Dream Team')
      expect(result.value.players).toHaveLength(3)
      expect(result.value.players![0]).toEqual({ slotIndex: 0, playerId: uuid(0), position: 'GK' })
      expect(result.value.players![1]).toEqual({ slotIndex: 1, playerId: uuid(1), position: 'CB' })
      expect(result.value.players![2]).toEqual({ slotIndex: 2, playerId: uuid(2), position: 'LB' })
    }
  })

  it('returns ok with no optional fields (POST, only formation)', () => {
    const result = post({ formation: '4-2-3-1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.formation).toBe('4-2-3-1')
      expect(result.value.name).toBeUndefined()
      expect(result.value.players).toBeUndefined()
    }
  })
})

// ---------------------------------------------------------------------------
// PUT / partial mode
// ---------------------------------------------------------------------------

describe('validateDreamTeamPayload — PUT mode (partial: true)', () => {
  it('returns error for empty object (no fields provided)', () => {
    const result = put({})
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe(
        'Legalább egy mezőt meg kell adni (name, formation vagy players)'
      )
  })

  it('accepts only name in partial mode', () => {
    const result = put({ name: 'Team X' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.name).toBe('Team X')
  })

  it('accepts only formation in partial mode', () => {
    const result = put({ formation: '4-3-3' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.formation).toBe('4-3-3')
  })

  it('accepts only players (empty array) in partial mode', () => {
    const result = put({ players: [] })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.players).toEqual([])
  })

  it('accepts all three fields together in partial mode', () => {
    const result = put({
      name: 'X',
      formation: '4-4-2',
      players: [validSlot(0)],
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.name).toBe('X')
      expect(result.value.formation).toBe('4-4-2')
      expect(result.value.players).toHaveLength(1)
    }
  })

  it('still validates formation when present in partial mode', () => {
    const result = put({ name: 'X', formation: 'bad-formation' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe(
        'Érvénytelen formáció (megengedett: 4-3-3, 4-2-3-1, 3-5-2, 4-4-2)'
      )
  })

  it('still validates name when present in partial mode', () => {
    const result = put({ name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.error).toBe('A név hossza 1 és 100 karakter között kell legyen')
  })

  it('still validates players when present in partial mode', () => {
    const result = put({ players: 'not-array' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A "players" mező tömb kell legyen')
  })

  it('returns error for null body in partial mode', () => {
    const result = put(null)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Érvénytelen kérés')
  })
})
