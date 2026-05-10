import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import { buildDefaultWidgetConfig } from '@/lib/constants/dashboard-widgets'

/**
 * POST /api/dashboard-preferences/reset — Iteration 26.
 *
 * Deletes the caller's `dashboard_preferences` row so that the next GET
 * returns the catalogue default. No-op when no row exists (also returns
 * 200 with the default config).
 *
 * We DELETE rather than NULL-ing `widget_config` because the column is
 * NOT NULL and because "no row" is the natural sentinel for "use defaults".
 */
export async function POST() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { error } = await supabase
    .from('dashboard_preferences')
    .delete()
    .eq('user_id', user.id)

  if (error) {
    return errorResponse(
      `Dashboard beállítások visszaállítása sikertelen: ${error.message}`,
      500
    )
  }

  return successResponse({
    widget_config: buildDefaultWidgetConfig(),
    is_default: true,
  })
}
