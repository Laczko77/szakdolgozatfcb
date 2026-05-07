import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// The module imports createServiceRoleClient at the top level.
// Mock it before the module is loaded so the import doesn't throw.
vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}))

import { createServiceRoleClient } from '@/lib/supabase/server'
import {
  POLL_WINNER_REWARD,
  POINTS_BUSINESS_RULE_SQLSTATE,
  awardPollWinners,
} from '@/lib/points'

// ---------------------------------------------------------------------------
// Supabase mock helper
// ---------------------------------------------------------------------------

function makeRpcMock(result: { data: unknown; error: unknown }) {
  const rpcFn = vi.fn().mockResolvedValue(result)
  ;(createServiceRoleClient as Mock).mockReturnValue({ rpc: rpcFn })
  return rpcFn
}

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

// ---------------------------------------------------------------------------
// awardPollWinners
// ---------------------------------------------------------------------------

describe('awardPollWinners', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validResult = {
    winners_credited: 5,
    already_credited: 2,
    total_correct: 7,
    reward_per_winner: 50,
  }

  it('returns a ResolvePollResult on success', async () => {
    makeRpcMock({ data: validResult, error: null })

    const result = await awardPollWinners('poll-1', 2)
    expect(result).toEqual(validResult)
  })

  it('calls rpc with resolve_poll and correct params', async () => {
    const rpc = makeRpcMock({ data: validResult, error: null })

    await awardPollWinners('poll-abc', 3)
    expect(rpc).toHaveBeenCalledWith('resolve_poll', {
      p_poll_id: 'poll-abc',
      p_correct_option: 3,
    })
  })

  it('returns all four numeric fields from the RPC result', async () => {
    makeRpcMock({ data: validResult, error: null })

    const result = await awardPollWinners('poll-2', 1)
    if (result instanceof Error) throw result
    expect(result.winners_credited).toBe(5)
    expect(result.already_credited).toBe(2)
    expect(result.total_correct).toBe(7)
    expect(result.reward_per_winner).toBe(50)
  })

  it('works when winners_credited is 0 (no eligible winners)', async () => {
    makeRpcMock({ data: { winners_credited: 0, already_credited: 0, total_correct: 0, reward_per_winner: 50 }, error: null })

    const result = await awardPollWinners('poll-3', 0)
    expect(result).toEqual({ winners_credited: 0, already_credited: 0, total_correct: 0, reward_per_winner: 50 })
  })

  it('returns an Error wrapping the Postgres error on RPC failure', async () => {
    makeRpcMock({ data: null, error: { message: 'Poll not found', code: 'P0001' } })

    const result = await awardPollWinners('poll-4', 1)
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('Poll not found')
  })

  it('preserves the SQLSTATE code on the returned Error', async () => {
    makeRpcMock({ data: null, error: { message: 'Poll already resolved', code: 'P0001' } })

    const result = await awardPollWinners('poll-5', 2) as Error & { code?: string }
    expect(result.code).toBe('P0001')
  })

  it('preserves a non-P0001 SQLSTATE for infrastructure errors', async () => {
    makeRpcMock({ data: null, error: { message: 'deadlock detected', code: '40P01' } })

    const result = await awardPollWinners('poll-6', 1) as Error & { code?: string }
    expect(result.code).toBe('40P01')
  })

  it('returns an Error when data is null and error is also null', async () => {
    makeRpcMock({ data: null, error: null })

    const result = await awardPollWinners('poll-7', 1)
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/váratlan/)
  })

  it('returns an Error when data is an array', async () => {
    makeRpcMock({ data: [validResult], error: null })

    const result = await awardPollWinners('poll-8', 1)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when winners_credited is a string instead of number', async () => {
    makeRpcMock({
      data: { winners_credited: '5', already_credited: 2, total_correct: 7, reward_per_winner: 50 },
      error: null,
    })

    const result = await awardPollWinners('poll-9', 1)
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/váratlan/)
  })

  it('returns an Error when reward_per_winner is missing', async () => {
    makeRpcMock({
      data: { winners_credited: 3, already_credited: 0, total_correct: 3 },
      error: null,
    })

    const result = await awardPollWinners('poll-10', 2)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when already_credited is missing', async () => {
    makeRpcMock({
      data: { winners_credited: 3, total_correct: 3, reward_per_winner: 50 },
      error: null,
    })

    const result = await awardPollWinners('poll-11', 2)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when total_correct is missing', async () => {
    makeRpcMock({
      data: { winners_credited: 3, already_credited: 0, reward_per_winner: 50 },
      error: null,
    })

    const result = await awardPollWinners('poll-12', 2)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when data is a plain number (primitive)', async () => {
    makeRpcMock({ data: 42, error: null })

    const result = await awardPollWinners('poll-13', 1)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an Error when data is a string', async () => {
    makeRpcMock({ data: 'ok', error: null })

    const result = await awardPollWinners('poll-14', 1)
    expect(result).toBeInstanceOf(Error)
  })
})
