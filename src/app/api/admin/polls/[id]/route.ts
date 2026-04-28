import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  errorResponse,
  requireAdminApi,
  successResponse,
} from '@/lib/api-utils'
import type { Poll, PollOption, TablesUpdate } from '@/types/database'
import { applyNoneOption, parseOptions } from '../route'

/**
 * /api/admin/polls/[id]
 *
 * PUT    — admin only. Partial update (question / options / match_id).
 *          Editing options is forbidden once the poll has been resolved
 *          (correct_option IS NOT NULL) — historical scoring would otherwise
 *          desync from the labels.
 *
 * DELETE — admin only. Removes the poll; votes cascade via FK,
 *          point_transactions.poll_id is set to NULL on delete.
 */

type RouteContext = {
  params: Promise<{ id: string }>
}

// ---------------------------------------------------------------------------
// PUT — update (admin)
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Érvénytelen JSON tartalom', 400)
  }
  if (typeof body !== 'object' || body === null) {
    return errorResponse('Érvénytelen kérés tartalom', 400)
  }
  const obj = body as Record<string, unknown>

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('polls')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Szavazás lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A szavazás nem található', 404)
  }
  const existing = existingRaw as Poll

  const update: TablesUpdate<'polls'> = {}

  if (obj.question !== undefined) {
    if (typeof obj.question !== 'string' || obj.question.trim().length === 0) {
      return errorResponse('A "question" mező nem lehet üres', 400)
    }
    update.question = obj.question.trim()
  }

  if (
    obj.options !== undefined ||
    obj.add_none_option !== undefined ||
    obj.none_option_text !== undefined
  ) {
    if (existing.correct_option !== null) {
      return errorResponse(
        'Lezárt szavazás opcióit már nem lehet módosítani',
        409
      )
    }

    // If the caller didn't send a fresh options[] but did send a none-option
    // toggle, mutate the existing options array. Otherwise parse the new one.
    const baseOptions = obj.options !== undefined
      ? parseOptions(obj.options)
      : (existing.options as PollOption[])

    if (baseOptions instanceof Error) {
      return errorResponse(baseOptions.message, 400)
    }

    // Iter17: append (or validate against) the "Más / Egyik sem" option.
    const finalOptions = applyNoneOption(
      baseOptions,
      obj.add_none_option,
      obj.none_option_text
    )
    if (finalOptions instanceof Error) {
      return errorResponse(finalOptions.message, 400)
    }

    update.options = finalOptions
  }

  if (obj.match_id !== undefined) {
    if (obj.match_id === null) {
      update.match_id = null
    } else if (typeof obj.match_id === 'string' && obj.match_id.trim().length > 0) {
      update.match_id = obj.match_id
    } else {
      return errorResponse('A "match_id" mező érvénytelen', 400)
    }
  }

  if (Object.keys(update).length === 0) {
    return successResponse(existing)
  }

  const { data, error } = await supabase
    .from('polls')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    return errorResponse(
      `Szavazás frissítése sikertelen: ${error?.message ?? 'ismeretlen hiba'}`,
      500
    )
  }

  return successResponse(data as Poll)
}

// ---------------------------------------------------------------------------
// DELETE — remove (admin)
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const guard = await requireAdminApi()
  if (guard instanceof NextResponse) return guard

  const { id } = await context.params
  if (!id) return errorResponse('Hiányzó azonosító', 400)

  const supabase = await createClient()

  const { data: existingRaw, error: fetchError } = await supabase
    .from('polls')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return errorResponse(`Szavazás lekérése sikertelen: ${fetchError.message}`, 500)
  }
  if (!existingRaw) {
    return errorResponse('A szavazás nem található', 404)
  }

  const { error: deleteError } = await supabase
    .from('polls')
    .delete()
    .eq('id', id)

  if (deleteError) {
    return errorResponse(
      `Szavazás törlése sikertelen: ${deleteError.message}`,
      500
    )
  }

  return NextResponse.json({ success: true })
}
