import { describe, it, expect } from 'vitest'
import {
  PLAYER_POSITION_LABELS,
  PLAYER_POSITION_LABELS_PLURAL,
  PLAYER_POSITION_SHORT,
} from '@/lib/player-positions'

// ---------------------------------------------------------------------------
// PLAYER_POSITION_LABELS — singular Hungarian labels
// ---------------------------------------------------------------------------

describe('PLAYER_POSITION_LABELS', () => {
  it('maps Goalkeeper to "Kapus"', () => {
    expect(PLAYER_POSITION_LABELS.Goalkeeper).toBe('Kapus')
  })

  it('maps Defender to "Védő"', () => {
    expect(PLAYER_POSITION_LABELS.Defender).toBe('Védő')
  })

  it('maps Midfielder to "Középpályás"', () => {
    expect(PLAYER_POSITION_LABELS.Midfielder).toBe('Középpályás')
  })

  it('maps Attacker to "Támadó"', () => {
    expect(PLAYER_POSITION_LABELS.Attacker).toBe('Támadó')
  })

  it('contains exactly 4 keys', () => {
    expect(Object.keys(PLAYER_POSITION_LABELS)).toHaveLength(4)
  })

  it('every value is a non-empty string', () => {
    for (const value of Object.values(PLAYER_POSITION_LABELS)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// PLAYER_POSITION_LABELS_PLURAL — plural Hungarian labels
// ---------------------------------------------------------------------------

describe('PLAYER_POSITION_LABELS_PLURAL', () => {
  it('maps Goalkeeper to "Kapusok"', () => {
    expect(PLAYER_POSITION_LABELS_PLURAL.Goalkeeper).toBe('Kapusok')
  })

  it('maps Defender to "Védők"', () => {
    expect(PLAYER_POSITION_LABELS_PLURAL.Defender).toBe('Védők')
  })

  it('maps Midfielder to "Középpályások"', () => {
    expect(PLAYER_POSITION_LABELS_PLURAL.Midfielder).toBe('Középpályások')
  })

  it('maps Attacker to "Támadók"', () => {
    expect(PLAYER_POSITION_LABELS_PLURAL.Attacker).toBe('Támadók')
  })

  it('contains exactly 4 keys', () => {
    expect(Object.keys(PLAYER_POSITION_LABELS_PLURAL)).toHaveLength(4)
  })

  it('every value is a non-empty string', () => {
    for (const value of Object.values(PLAYER_POSITION_LABELS_PLURAL)) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// PLAYER_POSITION_SHORT — two-letter abbreviations
// ---------------------------------------------------------------------------

describe('PLAYER_POSITION_SHORT', () => {
  it('maps Goalkeeper to "GK"', () => {
    expect(PLAYER_POSITION_SHORT.Goalkeeper).toBe('GK')
  })

  it('maps Defender to "DF"', () => {
    expect(PLAYER_POSITION_SHORT.Defender).toBe('DF')
  })

  it('maps Midfielder to "MP"', () => {
    expect(PLAYER_POSITION_SHORT.Midfielder).toBe('MP')
  })

  it('maps Attacker to "TM"', () => {
    expect(PLAYER_POSITION_SHORT.Attacker).toBe('TM')
  })

  it('contains exactly 4 keys', () => {
    expect(Object.keys(PLAYER_POSITION_SHORT)).toHaveLength(4)
  })

  it('every abbreviation is exactly 2 characters long', () => {
    for (const value of Object.values(PLAYER_POSITION_SHORT)) {
      expect(value).toHaveLength(2)
    }
  })
})

// ---------------------------------------------------------------------------
// Cross-map invariants
// ---------------------------------------------------------------------------

describe('PLAYER_POSITION_LABELS vs PLAYER_POSITION_LABELS_PLURAL', () => {
  it('singular and plural differ for Goalkeeper', () => {
    expect(PLAYER_POSITION_LABELS.Goalkeeper).not.toBe(
      PLAYER_POSITION_LABELS_PLURAL.Goalkeeper
    )
  })

  it('singular and plural differ for Defender', () => {
    expect(PLAYER_POSITION_LABELS.Defender).not.toBe(
      PLAYER_POSITION_LABELS_PLURAL.Defender
    )
  })

  it('singular and plural differ for Midfielder', () => {
    expect(PLAYER_POSITION_LABELS.Midfielder).not.toBe(
      PLAYER_POSITION_LABELS_PLURAL.Midfielder
    )
  })

  it('singular and plural differ for Attacker', () => {
    expect(PLAYER_POSITION_LABELS.Attacker).not.toBe(
      PLAYER_POSITION_LABELS_PLURAL.Attacker
    )
  })

  it('all three maps share the same set of keys', () => {
    const labelKeys = Object.keys(PLAYER_POSITION_LABELS).sort()
    const pluralKeys = Object.keys(PLAYER_POSITION_LABELS_PLURAL).sort()
    const shortKeys = Object.keys(PLAYER_POSITION_SHORT).sort()
    expect(labelKeys).toEqual(pluralKeys)
    expect(labelKeys).toEqual(shortKeys)
  })
})
