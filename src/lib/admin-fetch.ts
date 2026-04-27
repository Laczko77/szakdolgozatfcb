/**
 * Thin client-side fetch helpers for the admin panel.
 *
 * Centralises the success / error envelope shape used by route handlers in
 * `src/app/api/admin/**`:
 *
 *   - success: `{ data: T }`             (via successResponse)
 *   - error:   `{ error: string }`       (via errorResponse)
 *
 * A handful of older endpoints (notably GET /api/admin/coupons) return a
 * domain-specific top-level shape — those callers use `adminFetchRaw` and
 * read the property directly.
 */

export class AdminApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown }
    if (typeof body?.error === 'string' && body.error.trim().length > 0) {
      return body.error
    }
  } catch {
    /* ignored — non-JSON body */
  }
  return fallback
}

/**
 * Fetches an admin endpoint that returns the standard `{ data: T }` envelope.
 * Throws an AdminApiError on non-2xx responses.
 */
export async function adminFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  })
  if (!res.ok) {
    throw new AdminApiError(
      res.status,
      await readErrorMessage(res, `HTTP ${res.status}`)
    )
  }
  // 204 No Content
  if (res.status === 204) return undefined as T
  const json = (await res.json()) as { data?: T }
  return json.data as T
}

/**
 * Like `adminFetch` but returns the raw JSON body — for endpoints whose
 * response shape doesn't follow the `{ data }` convention.
 */
export async function adminFetchRaw<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
  })
  if (!res.ok) {
    throw new AdminApiError(
      res.status,
      await readErrorMessage(res, `HTTP ${res.status}`)
    )
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
