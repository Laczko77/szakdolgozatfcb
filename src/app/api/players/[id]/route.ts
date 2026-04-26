import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/api-utils'
import type { Player } from '@/types/database'

/**
 * GET /api/players/[id]
 *
 * Public endpoint. Returns a single player row (including the `stats` JSONB
 * payload) by primary key. 404s when the row does not exist.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return errorResponse(`Játékos lekérése sikertelen: ${error.message}`, 500)
  }
  if (!data) {
    return errorResponse('A játékos nem található', 404)
  }

  return NextResponse.json(data as Player)
}
