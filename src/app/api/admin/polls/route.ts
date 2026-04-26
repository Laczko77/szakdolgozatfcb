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
 *     options: PollOption[]   // length >= 2
 *     match_id?: string | null
 *   }
 */

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

  let matchId: string | null = null
  if (obj.match_id !== undefined && obj.match_id !== null) {
    if (typeof obj.match_id !== 'string' || obj.match_id.trim().length === 0) {
      return new Error('A "match_id" mező érvénytelen')
    }
    matchId = obj.match_id
  }

  return {
    question: obj.question.trim(),
    options,
    match_id: matchId,
  }
}

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
