import type { SupabaseClient } from '@supabase/supabase-js'
import { FIXED_SECTORS } from '@/lib/constants/sectors'
import type { Database, TablesInsert } from '@/types/database'

/**
 * Idempotently seed the four fixed sectors for a single match.
 *
 * Strategy: `INSERT ... ON CONFLICT (match_id, sector_name) DO NOTHING`.
 * This means re-running the seed (e.g. on every match sync) NEVER
 * overwrites admin-edited price / total_seats values — only missing
 * sectors are inserted.
 *
 * Returns the number of newly inserted sector rows. The caller can use
 * this for logging or to surface a "X sectors created" message.
 */
export async function seedFixedSectorsForMatch(
  supabase: SupabaseClient<Database>,
  matchId: string
): Promise<{ inserted: number; error: string | null }> {
  const rows: TablesInsert<'match_sectors'>[] = FIXED_SECTORS.map((s) => ({
    match_id: matchId,
    sector_name: s.name,
    total_seats: s.defaultSeats,
    sold_seats: 0,
    price: s.defaultPrice,
  }))

  const { data, error } = await supabase
    .from('match_sectors')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert(rows as any, {
      onConflict: 'match_id,sector_name',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) {
    return { inserted: 0, error: error.message }
  }

  // When ignoreDuplicates is true, the response only contains the rows
  // that were actually inserted (existing rows are skipped silently).
  return { inserted: data?.length ?? 0, error: null }
}
