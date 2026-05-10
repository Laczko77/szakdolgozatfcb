import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAuthApi,
  successResponse,
} from '@/lib/api-utils'
import {
  buildDefaultWidgetConfig,
  validateWidgetConfig,
  type WidgetConfigEntry,
} from '@/lib/constants/dashboard-widgets'
import type { DashboardPreference, DashboardPreferenceInsert, Json } from '@/types/database'

/**
 * /api/dashboard-preferences — Iteration 26.
 *
 * GET — returns the caller's saved widget configuration, or the catalogue
 *       default when no row exists yet (NEVER 404). Always returns a full,
 *       valid `widget_config` array so the frontend can render immediately.
 *
 * PUT — upsert semantics. Validates the payload against the catalogue and
 *       enforces unique widget_id and unique order values. Creates the row
 *       on first save (one row per user, enforced by UNIQUE on user_id).
 *
 * RLS already restricts every row to its owner; the explicit user_id filter
 * below is defense-in-depth and documents intent.
 */

interface DashboardPreferencesResponse {
  widget_config: WidgetConfigEntry[]
  is_default: boolean
}

// ---------------------------------------------------------------------------
// GET — return saved config or default
// ---------------------------------------------------------------------------

export async function GET() {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dashboard_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle<DashboardPreference>()

  if (error) {
    return errorResponse(
      `Dashboard beállítások lekérése sikertelen: ${error.message}`,
      500
    )
  }

  // No saved row → return the catalogue default. The frontend cannot
  // distinguish this from a saved-default, but the `is_default` flag lets
  // the settings UI show a "vissza az alapértelmezetthez" hint when needed.
  if (!data) {
    const payload: DashboardPreferencesResponse = {
      widget_config: buildDefaultWidgetConfig(),
      is_default: true,
    }
    return successResponse(payload)
  }

  // The DB column is JSONB and may technically hold any shape — re-validate
  // before returning so a corrupt row does not poison the frontend. If the
  // saved value is invalid (catalogue change, manual DB edit, etc.) we fall
  // back to the default.
  const validation = validateWidgetConfig(data.widget_config)
  const payload: DashboardPreferencesResponse = validation.ok
    ? { widget_config: validation.value, is_default: false }
    : { widget_config: buildDefaultWidgetConfig(), is_default: true }

  return successResponse(payload)
}

// ---------------------------------------------------------------------------
// PUT — upsert the caller's widget configuration
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest) {
  const guard = await requireAuthApi()
  if (guard instanceof NextResponse) return guard
  const { user } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  // Accept both `{ widget_config: [...] }` and a raw array — the explicit
  // wrapper is the documented contract; the bare array form is tolerated
  // for ergonomics.
  const rawConfig =
    body && typeof body === 'object' && 'widget_config' in body
      ? (body as { widget_config: unknown }).widget_config
      : body

  const validation = validateWidgetConfig(rawConfig)
  if (!validation.ok) return errorResponse(validation.error, 400)

  const supabase = await createClient()

  const insert: DashboardPreferenceInsert = {
    user_id: user.id,
    widget_config: validation.value as unknown as Json,
  }

  // We already have the validated config — no RETURNING needed. The
  // .upsert() call resolves to { error } only on the affected row count;
  // RLS-violating writes surface as an error here.
  const { error } = await supabase
    .from('dashboard_preferences')
    .upsert(insert as never, { onConflict: 'user_id' })

  if (error) {
    return errorResponse(
      `Dashboard beállítások mentése sikertelen: ${error.message}`,
      500
    )
  }

  const payload: DashboardPreferencesResponse = {
    widget_config: validation.value,
    is_default: false,
  }
  return successResponse(payload)
}
