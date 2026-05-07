import { describe, it, expect } from 'vitest'
import { isArticleCategory, isPlayerPosition } from '@/lib/constants'

describe('isArticleCategory', () => {
  // -------------------------------------------------------------------------
  // Valid categories
  // -------------------------------------------------------------------------

  it("returns true for 'transfers'", () => {
    expect(isArticleCategory('transfers')).toBe(true)
  })

  it("returns true for 'match-report'", () => {
    expect(isArticleCategory('match-report')).toBe(true)
  })

  it("returns true for 'interview'", () => {
    expect(isArticleCategory('interview')).toBe(true)
  })

  it("returns true for 'news'", () => {
    expect(isArticleCategory('news')).toBe(true)
  })

  it("returns true for 'opinion'", () => {
    expect(isArticleCategory('opinion')).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Invalid inputs
  // -------------------------------------------------------------------------

  it("returns false for an unrecognised string 'invalid'", () => {
    expect(isArticleCategory('invalid')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isArticleCategory('')).toBe(false)
  })

  it('returns false for a numeric value', () => {
    expect(isArticleCategory(123)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isArticleCategory(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isArticleCategory(undefined)).toBe(false)
  })

  it('returns false for a plain object', () => {
    expect(isArticleCategory({})).toBe(false)
  })

  it('returns false for an array', () => {
    expect(isArticleCategory(['news'])).toBe(false)
  })

  it('is case-sensitive — uppercase variant returns false', () => {
    expect(isArticleCategory('News')).toBe(false)
  })
})

describe('isPlayerPosition', () => {
  // -------------------------------------------------------------------------
  // Valid positions
  // -------------------------------------------------------------------------

  it("returns true for 'Goalkeeper'", () => {
    expect(isPlayerPosition('Goalkeeper')).toBe(true)
  })

  it("returns true for 'Defender'", () => {
    expect(isPlayerPosition('Defender')).toBe(true)
  })

  it("returns true for 'Midfielder'", () => {
    expect(isPlayerPosition('Midfielder')).toBe(true)
  })

  it("returns true for 'Attacker'", () => {
    expect(isPlayerPosition('Attacker')).toBe(true)
  })

  // -------------------------------------------------------------------------
  // Invalid inputs
  // -------------------------------------------------------------------------

  it("returns false for 'goalkeeper' (wrong case)", () => {
    expect(isPlayerPosition('goalkeeper')).toBe(false)
  })

  it("returns false for 'Forward' (not in the list)", () => {
    expect(isPlayerPosition('Forward')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isPlayerPosition('')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isPlayerPosition(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isPlayerPosition(undefined)).toBe(false)
  })

  it('returns false for a number', () => {
    expect(isPlayerPosition(1)).toBe(false)
  })

  it('returns false for a plain object', () => {
    expect(isPlayerPosition({})).toBe(false)
  })

  it("returns false for 'defender' (wrong case)", () => {
    expect(isPlayerPosition('defender')).toBe(false)
  })
})
