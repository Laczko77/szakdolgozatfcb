import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type { Poll, PollOption, TablesInsert } from '@/types/database'

/**
 * /api/admin/polls
 *
 * POST — admin only. Creates a new poll.
 *   Body (JSON): {
 *     question: string,
 *     options: Array<string | PollOption>,   // length >= 2
 *     add_none_option?: boolean,             // Iter17: append a "Más / Egyik sem" option
 *     none_option_text?: string,             // optional override, default: "Más / Egyik sem"
 *     match_id?: string | null
 *   }
 *
 * Iter17: the optional `add_none_option` flag appends a special PollOption
 * with `is_none: true` to the END of options[]. The constraint
 * `polls_options_none_option_shape` rejects misplaced or duplicate none
 * entries at the database level.
 */

export const DEFAULT_NONE_OPTION_TEXT = 'Más / Egyik sem'

export async function POST(request: NextRequest) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }

  const parsed = parseCreatePayload(body)
  if (parsed instanceof Error) {
    return errorResponse(parsed.message, 400)
  }

  const supabase = await createClient()

  const insert: TablesInsert<'polls'> = {
    question: parsed.question,
    options: parsed.options,
    match_id: parsed.match_id,
    correct_option: null,
  }

  const { data, error } = await supabase
    .from('polls')
    .insert(insert as never)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Szavazás létrehozása sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Poll, 201)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type CreatePayload = {
  question: string
  options: PollOption[]
  match_id: string | null
}

function parseCreatePayload(raw: unknown): CreatePayload | Error {
  if (typeof raw !== 'object' || raw === null) {
    return new Error('Érvénytelen kérés tartalom')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.question !== 'string' || obj.question.trim().length === 0) {
    return new Error('A "question" mező kötelező')
  }

  const options = parseOptions(obj.options)
  if (options instanceof Error) return options

  // Iter17: optionally append a "Más / Egyik sem" entry. The DB constraint
  // would reject a duplicate is_none, so we also reject here for a friendlier
  // 400 instead of letting it fall through to a generic 500.
  const noneResult = applyNoneOption(options, obj.add_none_option, obj.none_option_text)
  if (noneResult instanceof Error) return noneResult

  let matchId: string | null = null
  if (obj.match_id !== undefined && obj.match_id !== null) {
    if (typeof obj.match_id !== 'string' || obj.match_id.trim().length === 0) {
      return new Error('A "match_id" mező érvénytelen')
    }
    matchId = obj.match_id
  }

  return {
    question: obj.question.trim(),
    options: noneResult,
    match_id: matchId,
  }
}

/**
 * Validates an inbound `options` payload and normalises it to PollOption[].
 *
 * Accepts both legacy `string[]` shorthand and the canonical
 * `{ label, ...metadata }[]` shape (Iter17 callers may also pass
 * `is_none: true`, but typically the none flag is added by callers via
 * {@link applyNoneOption} rather than included by hand).
 */
export function parseOptions(raw: unknown): PollOption[] | Error {
  if (!Array.isArray(raw)) {
    return new Error('Az "options" mezőnek tömbnek kell lennie')
  }
  if (raw.length < 2) {
    return new Error('Legalább 2 válaszopciót meg kell adni')
  }

  const result: PollOption[] = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (typeof item === 'string') {
      const trimmed = item.trim()
      if (trimmed.length === 0) {
        return new Error(`Az ${i + 1}. opció üres`)
      }
      result.push({ label: trimmed })
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>
      if (typeof obj.label !== 'string' || obj.label.trim().length === 0) {
        return new Error(`Az ${i + 1}. opciónál hiányzik a "label" mező`)
      }
      result.push({ ...obj, label: obj.label.trim() } as PollOption)
    } else {
      return new Error(`Az ${i + 1}. opció érvénytelen`)
    }
  }
  return result
}

/**
 * Iter17: if `add_none_option` is truthy, appends a `{ label, is_none: true }`
 * option to the END of the array. Returns the new array (or an Error on
 * malformed input). If the caller passed `add_none_option: false`/missing
 * AND no inbound option already carries `is_none`, the array is returned
 * unchanged.
 *
 * Guards:
 *   - duplicate none entries (caller already provided one): rejected.
 *   - non-string `none_option_text`: rejected.
 */
export function applyNoneOption(
  options: PollOption[],
  addNoneOptionRaw: unknown,
  noneOptionTextRaw: unknown
): PollOption[] | Error {
  const existingNoneCount = options.filter((o) => o.is_none === true).length

  if (existingNoneCount > 1) {
    return new Error('Csak egy "Más / Egyik sem" opció lehet egy szavazásban')
  }

  if (addNoneOptionRaw === undefined || addNoneOptionRaw === null) {
    // No flag passed — leave existing options (including any already-flagged
    // is_none entry) untouched. The DB constraint will still verify shape.
    return options
  }

  if (typeof addNoneOptionRaw !== 'boolean') {
    return new Error('Az "add_none_option" mezőnek logikai értéknek kell lennie')
  }

  if (!addNoneOptionRaw) {
    return options
  }

  // addNoneOption === true: refuse to silently double-add if caller already
  // included a none entry inline.
  if (existingNoneCount === 1) {
    return new Error('Az opciók már tartalmaznak "Más / Egyik sem" elemet')
  }

  let label = DEFAULT_NONE_OPTION_TEXT
  if (noneOptionTextRaw !== undefined && noneOptionTextRaw !== null) {
    if (typeof noneOptionTextRaw !== 'string' || noneOptionTextRaw.trim().length === 0) {
      return new Error('A "none_option_text" mező nem lehet üres szöveg')
    }
    label = noneOptionTextRaw.trim()
  }

  return [...options, { label, is_none: true }]
}
