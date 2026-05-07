import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'
import { AdminApiError, adminFetch, adminFetchRaw } from '@/lib/admin-fetch'

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Build a minimal Response-shaped object that satisfies the subset of the
 * Response interface used by adminFetch / adminFetchRaw.
 */
function mockResponse(
  status: number,
  body: unknown,
  ok?: boolean
): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response
}

/**
 * Build a Response whose json() rejects (simulates a non-JSON body).
 */
function mockNonJsonResponse(status: number, ok?: boolean): Response {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
  } as unknown as Response
}

// ---------------------------------------------------------------------------
// AdminApiError
// ---------------------------------------------------------------------------

describe('AdminApiError', () => {
  it('has name === "AdminApiError"', () => {
    const err = new AdminApiError(404, 'Not found')
    expect(err.name).toBe('AdminApiError')
  })

  it('stores the HTTP status code on .status', () => {
    const err = new AdminApiError(404, 'Not found')
    expect(err.status).toBe(404)
  })

  it('stores the message in .message', () => {
    const err = new AdminApiError(404, 'Not found')
    expect(err.message).toBe('Not found')
  })

  it('is an instance of Error', () => {
    expect(new AdminApiError(500, 'Oops')).toBeInstanceOf(Error)
  })

  it('is an instance of AdminApiError', () => {
    expect(new AdminApiError(500, 'Oops')).toBeInstanceOf(AdminApiError)
  })
})

// ---------------------------------------------------------------------------
// adminFetch
// ---------------------------------------------------------------------------

describe('adminFetch', () => {
  // --- Success paths ---

  it('returns the .data property from a 200 response envelope', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { data: { id: 1 } }))
    const result = await adminFetch<{ id: number }>('/api/admin/test')
    expect(result).toEqual({ id: 1 })
  })

  it('returns the .data property from a 201 Created response envelope', async () => {
    mockFetch.mockResolvedValue(mockResponse(201, { data: { id: 2 } }))
    const result = await adminFetch<{ id: number }>('/api/admin/test')
    expect(result).toEqual({ id: 2 })
  })

  it('returns undefined for a 204 No Content response', async () => {
    mockFetch.mockResolvedValue(mockResponse(204, null))
    const result = await adminFetch('/api/admin/test')
    expect(result).toBeUndefined()
  })

  // --- Error paths ---

  it('throws AdminApiError with body.error message on a 400 response', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(400, { error: 'Hibás kérés' }, false)
    )
    await expect(adminFetch('/api/admin/test')).rejects.toMatchObject({
      name: 'AdminApiError',
      status: 400,
      message: 'Hibás kérés',
    })
  })

  it('falls back to "HTTP {status}" when body.error is an empty string', async () => {
    mockFetch.mockResolvedValue(mockResponse(401, { error: '' }, false))
    await expect(adminFetch('/api/admin/test')).rejects.toMatchObject({
      status: 401,
      message: 'HTTP 401',
    })
  })

  it('falls back to "HTTP {status}" when json() throws (non-JSON body)', async () => {
    mockFetch.mockResolvedValue(mockNonJsonResponse(500, false))
    await expect(adminFetch('/api/admin/test')).rejects.toMatchObject({
      status: 500,
      message: 'HTTP 500',
    })
  })

  it('falls back to "HTTP {status}" when body.error is whitespace-only', async () => {
    mockFetch.mockResolvedValue(mockResponse(422, { error: '   ' }, false))
    await expect(adminFetch('/api/admin/test')).rejects.toMatchObject({
      status: 422,
      message: 'HTTP 422',
    })
  })

  it('throws AdminApiError (not a plain Error) on failure', async () => {
    mockFetch.mockResolvedValue(mockResponse(404, { error: 'Not found' }, false))
    await expect(adminFetch('/api/admin/test')).rejects.toBeInstanceOf(
      AdminApiError
    )
  })

  // --- Headers: Content-Type ---

  it('adds Content-Type: application/json when body is a plain string (JSON)', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { data: null }))
    await adminFetch('/api/admin/test', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    })
    const [, init] = mockFetch.mock.calls[0] as [unknown, RequestInit]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    )
  })

  it('does NOT add Content-Type when body is FormData', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { data: null }))
    await adminFetch('/api/admin/test', {
      method: 'POST',
      body: new FormData(),
    })
    const [, init] = mockFetch.mock.calls[0] as [unknown, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  // --- credentials ---

  it('always passes credentials: "include"', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { data: {} }))
    await adminFetch('/api/admin/test')
    const [, init] = mockFetch.mock.calls[0] as [unknown, RequestInit]
    expect(init.credentials).toBe('include')
  })

  it('passes credentials: "include" even when no init is provided', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, { data: {} }))
    await adminFetch('/api/admin/test')
    const [, init] = mockFetch.mock.calls[0] as [unknown, RequestInit]
    expect(init.credentials).toBe('include')
  })
})

// ---------------------------------------------------------------------------
// adminFetchRaw
// ---------------------------------------------------------------------------

describe('adminFetchRaw', () => {
  // --- Success paths ---

  it('returns the full JSON body (not .data) on a 200 response', async () => {
    const payload = { items: [1, 2, 3] }
    mockFetch.mockResolvedValue(mockResponse(200, payload))
    const result = await adminFetchRaw<typeof payload>('/api/admin/coupons')
    expect(result).toEqual({ items: [1, 2, 3] })
  })

  it('returns undefined for a 204 No Content response', async () => {
    mockFetch.mockResolvedValue(mockResponse(204, null))
    const result = await adminFetchRaw('/api/admin/test')
    expect(result).toBeUndefined()
  })

  // --- Error paths ---

  it('throws AdminApiError with body.error on a 404 response', async () => {
    mockFetch.mockResolvedValue(
      mockResponse(404, { error: 'Not found' }, false)
    )
    await expect(adminFetchRaw('/api/admin/test')).rejects.toMatchObject({
      name: 'AdminApiError',
      status: 404,
      message: 'Not found',
    })
  })

  // --- Headers: Content-Type ---

  it('does NOT add Content-Type when body is FormData', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}))
    await adminFetchRaw('/api/admin/upload', {
      method: 'POST',
      body: new FormData(),
    })
    const [, init] = mockFetch.mock.calls[0] as [unknown, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('adds Content-Type: application/json for non-FormData body', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}))
    await adminFetchRaw('/api/admin/test', {
      method: 'POST',
      body: JSON.stringify({ key: 'value' }),
    })
    const [, init] = mockFetch.mock.calls[0] as [unknown, RequestInit]
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json'
    )
  })

  it('always passes credentials: "include"', async () => {
    mockFetch.mockResolvedValue(mockResponse(200, {}))
    await adminFetchRaw('/api/admin/test')
    const [, init] = mockFetch.mock.calls[0] as [unknown, RequestInit]
    expect(init.credentials).toBe('include')
  })
})
