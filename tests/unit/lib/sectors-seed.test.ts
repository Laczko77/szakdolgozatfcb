/**
 * Unit tests for src/lib/sectors-seed.ts
 *
 * The Supabase client is passed in as a parameter, so we can construct a
 * minimal mock object inline — no vi.mock needed.
 *
 * What is tested:
 *  - Happy path: all 4 sectors inserted → inserted === 4
 *  - Idempotent / partial path: 0 rows returned (all duplicates) → inserted === 0
 *  - Partial insertion: 2 of 4 rows newly inserted → inserted === 2
 *  - Error path: Supabase returns an error → { inserted: 0, error: message }
 *  - Correct match_id propagation to every row
 *  - Correct shape of rows passed to upsert (sector names, defaults)
 */

import { describe, it, expect, vi } from 'vitest'
import { seedFixedSectorsForMatch } from '@/lib/sectors-seed'
import { FIXED_SECTORS } from '@/lib/constants/sectors'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal SupabaseClient-shaped mock that fulfills the fluent chain:
 *   supabase.from('match_sectors').upsert(...).select('id')
 *
 * `resolvedValue` is what the final .select('id') promise resolves to.
 */
function buildMockClient(resolvedValue: { data: { id: string }[] | null; error: { message: string } | null }) {
  const selectMock = vi.fn().mockResolvedValue(resolvedValue)
  const upsertMock = vi.fn().mockReturnValue({ select: selectMock })
  const fromMock = vi.fn().mockReturnValue({ upsert: upsertMock })

  return {
    client: { from: fromMock } as unknown as SupabaseClient<Database>,
    fromMock,
    upsertMock,
    selectMock,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedFixedSectorsForMatch', () => {
  // ---- Happy path: all sectors freshly inserted ----

  it('returns inserted === 4 when all four sector rows are new', async () => {
    const { client } = buildMockClient({
      data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
      error: null,
    })

    const result = await seedFixedSectorsForMatch(client, 'match-001')

    expect(result).toEqual({ inserted: 4, error: null })
  })

  it('returns error === null on success', async () => {
    const { client } = buildMockClient({ data: [{ id: 'x' }], error: null })
    const result = await seedFixedSectorsForMatch(client, 'match-001')
    expect(result.error).toBeNull()
  })

  // ---- Idempotency: no new rows (all existed) ----

  it('returns inserted === 0 when all sectors already exist (ignoreDuplicates)', async () => {
    const { client } = buildMockClient({ data: [], error: null })
    const result = await seedFixedSectorsForMatch(client, 'match-002')
    expect(result).toEqual({ inserted: 0, error: null })
  })

  it('returns inserted === 0 when data is null (edge case from Supabase)', async () => {
    const { client } = buildMockClient({ data: null, error: null })
    const result = await seedFixedSectorsForMatch(client, 'match-003')
    expect(result).toEqual({ inserted: 0, error: null })
  })

  // ---- Partial insertion ----

  it('returns inserted === 2 when only 2 of the 4 sectors are new', async () => {
    const { client } = buildMockClient({ data: [{ id: 'n1' }, { id: 'n2' }], error: null })
    const result = await seedFixedSectorsForMatch(client, 'match-004')
    expect(result).toEqual({ inserted: 2, error: null })
  })

  // ---- Error path ----

  it('returns { inserted: 0, error: <message> } when Supabase returns an error', async () => {
    const { client } = buildMockClient({
      data: null,
      error: { message: 'duplicate key value violates unique constraint' },
    })

    const result = await seedFixedSectorsForMatch(client, 'match-005')

    expect(result.inserted).toBe(0)
    expect(result.error).toBe('duplicate key value violates unique constraint')
  })

  it('does NOT return inserted > 0 when there is a Supabase error', async () => {
    const { client } = buildMockClient({ data: [{ id: 'phantom' }], error: { message: 'network error' } })
    // Even if data is non-null, error takes priority
    const result = await seedFixedSectorsForMatch(client, 'match-006')
    expect(result.inserted).toBe(0)
  })

  // ---- Correct arguments passed through to Supabase ----

  it('calls from() with "match_sectors"', async () => {
    const { client, fromMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-010')
    expect(fromMock).toHaveBeenCalledWith('match_sectors')
  })

  it('calls upsert with ignoreDuplicates: true and onConflict "match_id,sector_name"', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-010')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        onConflict: 'match_id,sector_name',
        ignoreDuplicates: true,
      })
    )
  })

  it('calls select("id") after upsert', async () => {
    const { client, selectMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-010')
    expect(selectMock).toHaveBeenCalledWith('id')
  })

  it('passes exactly 4 rows to upsert (one per FIXED_SECTORS entry)', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-011')
    const rows = upsertMock.mock.calls[0][0] as unknown[]
    expect(rows).toHaveLength(FIXED_SECTORS.length)
    expect(rows).toHaveLength(4)
  })

  it('sets match_id on every row to the provided matchId', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    const matchId = 'match-specific-uuid'
    await seedFixedSectorsForMatch(client, matchId)
    const rows = upsertMock.mock.calls[0][0] as Array<{ match_id: string }>
    rows.forEach((row) => {
      expect(row.match_id).toBe(matchId)
    })
  })

  it('sets sold_seats to 0 on every row', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-012')
    const rows = upsertMock.mock.calls[0][0] as Array<{ sold_seats: number }>
    rows.forEach((row) => {
      expect(row.sold_seats).toBe(0)
    })
  })

  it('includes the TRIBUNA sector row with correct defaults', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-013')
    const rows = upsertMock.mock.calls[0][0] as Array<{
      sector_name: string
      total_seats: number
      price: number
    }>
    const tribuna = rows.find((r) => r.sector_name === 'TRIBUNA')
    expect(tribuna).toBeDefined()
    expect(tribuna!.total_seats).toBe(500)
    expect(tribuna!.price).toBe(25000)
  })

  it('includes the LATERAL sector row with correct defaults', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-014')
    const rows = upsertMock.mock.calls[0][0] as Array<{
      sector_name: string
      total_seats: number
      price: number
    }>
    const lateral = rows.find((r) => r.sector_name === 'LATERAL')
    expect(lateral).toBeDefined()
    expect(lateral!.total_seats).toBe(800)
    expect(lateral!.price).toBe(18000)
  })

  it('includes the GOL NORD sector row with correct defaults', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-015')
    const rows = upsertMock.mock.calls[0][0] as Array<{
      sector_name: string
      total_seats: number
      price: number
    }>
    const golNord = rows.find((r) => r.sector_name === 'GOL NORD')
    expect(golNord).toBeDefined()
    expect(golNord!.total_seats).toBe(400)
    expect(golNord!.price).toBe(12000)
  })

  it('includes the GOL SUD sector row with correct defaults', async () => {
    const { client, upsertMock } = buildMockClient({ data: [], error: null })
    await seedFixedSectorsForMatch(client, 'match-016')
    const rows = upsertMock.mock.calls[0][0] as Array<{
      sector_name: string
      total_seats: number
      price: number
    }>
    const golSud = rows.find((r) => r.sector_name === 'GOL SUD')
    expect(golSud).toBeDefined()
    expect(golSud!.total_seats).toBe(400)
    expect(golSud!.price).toBe(12000)
  })

  it('works with different matchId values without cross-contamination', async () => {
    const { client: c1, upsertMock: u1 } = buildMockClient({ data: [], error: null })
    const { client: c2, upsertMock: u2 } = buildMockClient({ data: [], error: null })

    await seedFixedSectorsForMatch(c1, 'match-A')
    await seedFixedSectorsForMatch(c2, 'match-B')

    const rows1 = u1.mock.calls[0][0] as Array<{ match_id: string }>
    const rows2 = u2.mock.calls[0][0] as Array<{ match_id: string }>

    rows1.forEach((r) => expect(r.match_id).toBe('match-A'))
    rows2.forEach((r) => expect(r.match_id).toBe('match-B'))
  })

  // ---- Return type invariant ----

  it('always returns an object with numeric inserted and string|null error', async () => {
    const { client } = buildMockClient({ data: [{ id: '1' }], error: null })
    const result = await seedFixedSectorsForMatch(client, 'match-020')
    expect(typeof result.inserted).toBe('number')
    expect(result.error === null || typeof result.error === 'string').toBe(true)
  })
})
