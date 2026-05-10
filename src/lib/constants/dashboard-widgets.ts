/**
 * Dashboard widget catalogue — Iteration 26.
 *
 * Single source of truth shared between backend (validation, default config
 * generation) and frontend (rendering, settings UI). Adding a new widget
 * is a one-line change here; no database migration required because the
 * `dashboard_preferences.widget_config` column is JSONB.
 *
 * Each entry's `id` is the stable identifier persisted in the database; do
 * NOT rename existing ids without writing a data migration. `defaultVisible`
 * and `defaultOrder` only apply to users who have never saved a custom
 * configuration (or have just reset).
 */

export const DASHBOARD_WIDGETS = [
  { id: 'next_match', label: 'Következő meccs', defaultVisible: true, defaultOrder: 0 },
  { id: 'latest_news', label: 'Legújabb hírek', defaultVisible: true, defaultOrder: 1 },
  { id: 'points_balance', label: 'Pontegyenleg', defaultVisible: true, defaultOrder: 2 },
  { id: 'orders', label: 'Rendelések', defaultVisible: true, defaultOrder: 3 },
  { id: 'standings', label: 'Tabella', defaultVisible: true, defaultOrder: 4 },
  { id: 'top_scorers', label: 'Top gólszerzők', defaultVisible: true, defaultOrder: 5 },
  { id: 'active_polls', label: 'Szavazások', defaultVisible: false, defaultOrder: 6 },
  { id: 'recommended_products', label: 'Ajánlott termékek', defaultVisible: false, defaultOrder: 7 },
] as const

export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number]['id']

export interface WidgetConfigEntry {
  widget_id: DashboardWidgetId
  visible: boolean
  order: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_WIDGET_IDS: ReadonlySet<string> = new Set(
  DASHBOARD_WIDGETS.map((w) => w.id)
)

/**
 * Type guard — true when `value` is one of the known widget ids.
 */
export function isDashboardWidgetId(value: unknown): value is DashboardWidgetId {
  return typeof value === 'string' && VALID_WIDGET_IDS.has(value)
}

/**
 * Build the default widget configuration from the catalogue. Used by the
 * GET endpoint when no row exists for the caller, and by the reset
 * behaviour (after DELETE the next GET reproduces this).
 */
export function buildDefaultWidgetConfig(): WidgetConfigEntry[] {
  return DASHBOARD_WIDGETS.map((w) => ({
    widget_id: w.id,
    visible: w.defaultVisible,
    order: w.defaultOrder,
  }))
}

export type WidgetConfigValidationResult =
  | { ok: true; value: WidgetConfigEntry[] }
  | { ok: false; error: string }

/**
 * Validate a `widget_config` payload sent to the PUT endpoint.
 *
 * Rules:
 *   - Must be an array.
 *   - Every entry must have a `widget_id` from the catalogue, a boolean
 *     `visible`, and a non-negative integer `order`.
 *   - `widget_id` values must be unique across the array.
 *   - `order` values must be unique across the array (so the frontend can
 *     render a deterministic sequence without tie-breaking).
 *
 * Unknown widget ids and duplicate ids are both rejected with 400; the
 * frontend is expected to send the full catalogue every time, omitting
 * widgets only by setting `visible = false`.
 */
export function validateWidgetConfig(
  raw: unknown
): WidgetConfigValidationResult {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'A widget_config csak tömb lehet' }
  }

  const seenIds = new Set<string>()
  const seenOrders = new Set<number>()
  const result: WidgetConfigEntry[] = []

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!item || typeof item !== 'object') {
      return { ok: false, error: `A ${i}. elem nem objektum` }
    }
    const candidate = item as Record<string, unknown>

    if (!isDashboardWidgetId(candidate.widget_id)) {
      return {
        ok: false,
        error: `Ismeretlen widget_id: ${String(candidate.widget_id)}`,
      }
    }
    if (seenIds.has(candidate.widget_id)) {
      return {
        ok: false,
        error: `Duplikált widget_id: ${candidate.widget_id}`,
      }
    }

    if (typeof candidate.visible !== 'boolean') {
      return {
        ok: false,
        error: `A "${candidate.widget_id}" widget visible mezője csak boolean lehet`,
      }
    }

    if (
      typeof candidate.order !== 'number' ||
      !Number.isInteger(candidate.order) ||
      candidate.order < 0
    ) {
      return {
        ok: false,
        error: `A "${candidate.widget_id}" widget order mezője csak nem-negatív egész szám lehet`,
      }
    }
    if (seenOrders.has(candidate.order)) {
      return {
        ok: false,
        error: `Duplikált order érték: ${candidate.order}`,
      }
    }

    seenIds.add(candidate.widget_id)
    seenOrders.add(candidate.order)
    result.push({
      widget_id: candidate.widget_id,
      visible: candidate.visible,
      order: candidate.order,
    })
  }

  return { ok: true, value: result }
}
