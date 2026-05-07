import { describe, it, expect, vi } from 'vitest'

// The module imports createServiceRoleClient at the top level.
// Mock it before the module is loaded so the import doesn't throw.
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}))

import {
  POLL_WINNER_REWARD,
  POINTS_BUSINESS_RULE_SQLSTATE,
} from '@/lib/points'

// ---------------------------------------------------------------------------
// POLL_WINNER_REWARD
// ---------------------------------------------------------------------------

describe('POLL_WINNER_REWARD', () => {
  it('equals 50', () => {
    expect(POLL_WINNER_REWARD).toBe(50)
  })

  it('is a number', () => {
    expect(typeof POLL_WINNER_REWARD).toBe('number')
  })

  it('is positive (rewards must be greater than zero)', () => {
    expect(POLL_WINNER_REWARD).toBeGreaterThan(0)
  })

  it('is an integer (no fractional points)', () => {
    expect(Number.isInteger(POLL_WINNER_REWARD)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// POINTS_BUSINESS_RULE_SQLSTATE
// ---------------------------------------------------------------------------

describe('POINTS_BUSINESS_RULE_SQLSTATE', () => {
  it('equals "P0001"', () => {
    expect(POINTS_BUSINESS_RULE_SQLSTATE).toBe('P0001')
  })

  it('is a string', () => {
    expect(typeof POINTS_BUSINESS_RULE_SQLSTATE).toBe('string')
  })

  it('is exactly 5 characters long (SQLSTATE standard length)', () => {
    expect(POINTS_BUSINESS_RULE_SQLSTATE).toHaveLength(5)
  })

  it('starts with "P" (PostgreSQL-raised exception class)', () => {
    expect(POINTS_BUSINESS_RULE_SQLSTATE.startsWith('P')).toBe(true)
  })
})
