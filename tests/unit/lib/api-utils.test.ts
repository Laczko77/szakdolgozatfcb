/**
 * Unit tests for src/lib/api-utils.ts
 *
 * `errorResponse` and `successResponse` are pure NextResponse.json() wrappers.
 * `requireAuthApi` and `requireAdminApi` depend on `getCurrentUser()` which is
 * mocked via vi.mock so we can control the return value for each test.
 *
 * NextResponse is available in the Node test environment because Next.js ships
 * it as a first-class module (no DOM required).
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'
import { NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Mock @/lib/auth so that getCurrentUser() can be controlled per-test
// ---------------------------------------------------------------------------
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

import { errorResponse, successResponse, requireAuthApi, requireAdminApi } from '@/lib/api-utils'
import { getCurrentUser } from '@/lib/auth'

const mockGetCurrentUser = vi.mocked(getCurrentUser)

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-1',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as User
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-uuid-1',
    email: 'test@example.com',
    username: 'testuser',
    avatar_url: null,
    role: 'user',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helper: parse a NextResponse body
// ---------------------------------------------------------------------------
async function parseBody(res: NextResponse): Promise<unknown> {
  // NextResponse extends Response; .json() reads the body stream
  return res.json()
}

// ---------------------------------------------------------------------------
// errorResponse
// ---------------------------------------------------------------------------

describe('errorResponse', () => {
  it('returns a NextResponse instance', () => {
    expect(errorResponse('Hiba', 400)).toBeInstanceOf(NextResponse)
  })

  it('sets the HTTP status code correctly', () => {
    expect(errorResponse('Hiba', 404).status).toBe(404)
  })

  it('sets the body to { error: <message> }', async () => {
    const res = errorResponse('Valami hiba', 400)
    expect(await parseBody(res)).toEqual({ error: 'Valami hiba' })
  })

  it('works with status 500', async () => {
    const res = errorResponse('Szerver hiba', 500)
    expect(res.status).toBe(500)
    expect(await parseBody(res)).toEqual({ error: 'Szerver hiba' })
  })

  it('works with status 401', async () => {
    const res = errorResponse('Bejelentkezés szükséges', 401)
    expect(res.status).toBe(401)
    expect(await parseBody(res)).toEqual({ error: 'Bejelentkezés szükséges' })
  })

  it('works with status 403', async () => {
    const res = errorResponse('Admin jogosultság szükséges', 403)
    expect(res.status).toBe(403)
    expect(await parseBody(res)).toEqual({ error: 'Admin jogosultság szükséges' })
  })

  it('preserves an empty string message', async () => {
    const res = errorResponse('', 400)
    expect(await parseBody(res)).toEqual({ error: '' })
  })

  it('preserves a Unicode / Hungarian message intact', async () => {
    const msg = 'Érvénytelen kérés — újra kell próbálni'
    const res = errorResponse(msg, 422)
    expect(await parseBody(res)).toEqual({ error: msg })
  })
})

// ---------------------------------------------------------------------------
// successResponse
// ---------------------------------------------------------------------------

describe('successResponse', () => {
  it('returns a NextResponse instance', () => {
    expect(successResponse({ id: 1 })).toBeInstanceOf(NextResponse)
  })

  it('defaults to HTTP 200', () => {
    expect(successResponse({ ok: true }).status).toBe(200)
  })

  it('accepts an explicit status (201 for creation)', () => {
    expect(successResponse({ id: 99 }, 201).status).toBe(201)
  })

  it('sets the body to { data: <payload> }', async () => {
    const res = successResponse({ id: 42, name: 'test' })
    expect(await parseBody(res)).toEqual({ data: { id: 42, name: 'test' } })
  })

  it('wraps an array payload under { data: [...] }', async () => {
    const res = successResponse([1, 2, 3])
    expect(await parseBody(res)).toEqual({ data: [1, 2, 3] })
  })

  it('wraps a null payload under { data: null }', async () => {
    const res = successResponse(null)
    expect(await parseBody(res)).toEqual({ data: null })
  })

  it('wraps a string payload under { data: "..." }', async () => {
    const res = successResponse('hello')
    expect(await parseBody(res)).toEqual({ data: 'hello' })
  })

  it('wraps a numeric payload under { data: 0 }', async () => {
    const res = successResponse(0)
    expect(await parseBody(res)).toEqual({ data: 0 })
  })

  // Note: NextResponse.json() rejects HTTP 204 because 204 No Content cannot
  // carry a body per the HTTP spec. The successResponse helper is only called
  // with body-bearing status codes (200, 201). No test for 204 here.
})

// ---------------------------------------------------------------------------
// requireAuthApi
// ---------------------------------------------------------------------------

describe('requireAuthApi', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
  })

  it('returns { user, profile } when both exist', async () => {
    const user = makeUser()
    const profile = makeProfile()
    mockGetCurrentUser.mockResolvedValue({ user, profile })

    const result = await requireAuthApi()

    expect(result).not.toBeInstanceOf(NextResponse)
    expect((result as { user: User; profile: Profile }).user).toBe(user)
    expect((result as { user: User; profile: Profile }).profile).toBe(profile)
  })

  it('returns a 401 NextResponse when user is null', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: null, profile: null })

    const result = await requireAuthApi()

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns a 401 body with Hungarian message when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: null, profile: null })

    const result = await requireAuthApi()
    const body = await (result as NextResponse).json()

    expect(body).toEqual({ error: 'Bejelentkezés szükséges' })
  })

  it('returns a 500 NextResponse when user exists but profile is null', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: makeUser(), profile: null })

    const result = await requireAuthApi()

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(500)
  })

  it('returns a 500 body with Hungarian message when profile is missing', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: makeUser(), profile: null })

    const result = await requireAuthApi()
    const body = await (result as NextResponse).json()

    expect(body).toEqual({ error: 'Profil nem található' })
  })

  it('the happy-path result is NOT an instance of NextResponse', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: makeUser(), profile: makeProfile() })

    const result = await requireAuthApi()

    expect(result).not.toBeInstanceOf(NextResponse)
  })
})

// ---------------------------------------------------------------------------
// requireAdminApi
// ---------------------------------------------------------------------------

describe('requireAdminApi', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
  })

  it('returns { user, profile } when the user is an admin', async () => {
    const user = makeUser()
    const profile = makeProfile({ role: 'admin' })
    mockGetCurrentUser.mockResolvedValue({ user, profile })

    const result = await requireAdminApi()

    expect(result).not.toBeInstanceOf(NextResponse)
    expect((result as { user: User; profile: Profile }).profile.role).toBe('admin')
  })

  it('returns a 401 NextResponse when the user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: null, profile: null })

    const result = await requireAdminApi()

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(401)
  })

  it('returns a 403 NextResponse when the user is authenticated but not an admin', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: makeUser(), profile: makeProfile({ role: 'user' }) })

    const result = await requireAdminApi()

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(403)
  })

  it('returns a 403 body with Hungarian message for non-admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: makeUser(), profile: makeProfile({ role: 'user' }) })

    const result = await requireAdminApi()
    const body = await (result as NextResponse).json()

    expect(body).toEqual({ error: 'Admin jogosultság szükséges' })
  })

  it('returns a 500 when the user exists but profile is null', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: makeUser(), profile: null })

    const result = await requireAdminApi()

    expect(result).toBeInstanceOf(NextResponse)
    expect((result as NextResponse).status).toBe(500)
  })

  it('the happy-path result has both user and profile', async () => {
    const user = makeUser()
    const profile = makeProfile({ role: 'admin' })
    mockGetCurrentUser.mockResolvedValue({ user, profile })

    const result = await requireAdminApi()
    const ctx = result as { user: User; profile: Profile }

    expect(ctx.user).toBe(user)
    expect(ctx.profile).toBe(profile)
  })

  it('the 401 body is { error: "Bejelentkezés szükséges" } (not the 403 message)', async () => {
    mockGetCurrentUser.mockResolvedValue({ user: null, profile: null })

    const result = await requireAdminApi()
    const body = await (result as NextResponse).json()

    expect(body).toEqual({ error: 'Bejelentkezés szükséges' })
  })
})
