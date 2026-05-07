/**
 * Unit tests for src/lib/auth.ts
 *
 * `createClient()` from `@/lib/supabase/server` is mocked via vi.mock so that
 * every Supabase network call can be controlled per test.
 *
 * Tested functions:
 *  - getCurrentUser()
 *  - isAdmin()
 *  - requireAdmin()
 *  - getSession()
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

// ---------------------------------------------------------------------------
// Mock createClient — must be declared before any import of @/lib/auth
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { getCurrentUser, isAdmin, requireAdmin, getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const mockCreateClient = vi.mocked(createClient)

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-99',
    email: 'fan@fcb.cat',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-06-01T00:00:00Z',
    ...overrides,
  } as User
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-uuid-99',
    email: 'fan@fcb.cat',
    username: 'culer',
    avatar_url: null,
    role: 'user',
    created_at: '2024-06-01T00:00:00Z',
    ...overrides,
  }
}

function makeSession(user: User): Session {
  return {
    access_token: 'access-token-abc',
    refresh_token: 'refresh-token-xyz',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as Session
}

// ---------------------------------------------------------------------------
// Helper: build the mock Supabase client with chainable query builders
// ---------------------------------------------------------------------------

type SingleResult<T> = { data: T | null; error: null }

interface MockSupabaseOptions {
  authUser?: User | null
  profileData?: Profile | Pick<Profile, 'role'> | null
  sessionData?: Session | null
}

function buildMockSupabase(options: MockSupabaseOptions = {}) {
  const { authUser = null, profileData = null, sessionData = null } = options

  // .auth.getUser()
  const getUserMock = vi.fn().mockResolvedValue({
    data: { user: authUser },
    error: null,
  })

  // .auth.getSession()
  const getSessionMock = vi.fn().mockResolvedValue({
    data: { session: sessionData },
    error: null,
  })

  // Chainable query builder for profiles table:
  // .from('profiles').select('*' | 'role').eq('id', ...).single()
  const singleMock = vi.fn().mockResolvedValue({
    data: profileData,
    error: null,
  } as SingleResult<typeof profileData>)

  const eqMock = vi.fn().mockReturnValue({ single: singleMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })

  const client = {
    auth: {
      getUser: getUserMock,
      getSession: getSessionMock,
    },
    from: fromMock,
  }

  // createClient resolves with the mock client
  mockCreateClient.mockResolvedValue(client as never)

  return { client, getUserMock, getSessionMock, fromMock, selectMock, eqMock, singleMock }
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------

describe('getCurrentUser', () => {
  beforeEach(() => {
    mockCreateClient.mockReset()
  })

  it('returns { user, profile } when both exist', async () => {
    const user = makeUser()
    const profile = makeProfile()
    buildMockSupabase({ authUser: user, profileData: profile })

    const result = await getCurrentUser()

    expect(result.user).toBe(user)
    expect(result.profile).toBe(profile)
  })

  it('returns { user: null, profile: null } when there is no authenticated user', async () => {
    buildMockSupabase({ authUser: null })

    const result = await getCurrentUser()

    expect(result.user).toBeNull()
    expect(result.profile).toBeNull()
  })

  it('does not query the profiles table when there is no user', async () => {
    const { fromMock } = buildMockSupabase({ authUser: null })

    await getCurrentUser()

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('queries the profiles table with the user id when user exists', async () => {
    const user = makeUser({ id: 'specific-uid' })
    const { eqMock } = buildMockSupabase({ authUser: user, profileData: makeProfile({ id: 'specific-uid' }) })

    await getCurrentUser()

    expect(eqMock).toHaveBeenCalledWith('id', 'specific-uid')
  })

  it('returns { user, profile: null } when profile row is missing', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: null })

    const result = await getCurrentUser()

    expect(result.user).not.toBeNull()
    expect(result.profile).toBeNull()
  })

  it('uses createClient exactly once per call', async () => {
    buildMockSupabase({ authUser: null })

    await getCurrentUser()

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// isAdmin
// ---------------------------------------------------------------------------

describe('isAdmin', () => {
  beforeEach(() => {
    mockCreateClient.mockReset()
  })

  it('returns true when the authenticated user has role "admin"', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: { role: 'admin' } })

    expect(await isAdmin()).toBe(true)
  })

  it('returns false when the authenticated user has role "user"', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: { role: 'user' } })

    expect(await isAdmin()).toBe(false)
  })

  it('returns false when there is no authenticated user', async () => {
    buildMockSupabase({ authUser: null })

    expect(await isAdmin()).toBe(false)
  })

  it('returns false when the profile row is null (deleted out-of-band)', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: null })

    expect(await isAdmin()).toBe(false)
  })

  it('does not query the profiles table when there is no user', async () => {
    const { fromMock } = buildMockSupabase({ authUser: null })

    await isAdmin()

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('queries with select("role") not select("*")', async () => {
    const { selectMock } = buildMockSupabase({ authUser: makeUser(), profileData: { role: 'admin' } })

    await isAdmin()

    expect(selectMock).toHaveBeenCalledWith('role')
  })

  it('always returns a boolean', async () => {
    buildMockSupabase({ authUser: null })
    expect(typeof (await isAdmin())).toBe('boolean')
  })
})

// ---------------------------------------------------------------------------
// requireAdmin
// ---------------------------------------------------------------------------

describe('requireAdmin', () => {
  beforeEach(() => {
    mockCreateClient.mockReset()
  })

  it('returns { user, profile } when the user is an admin', async () => {
    const user = makeUser()
    const profile = makeProfile({ role: 'admin' })
    buildMockSupabase({ authUser: user, profileData: profile })

    const result = await requireAdmin()

    expect(result.user).toBe(user)
    expect(result.profile).toBe(profile)
  })

  it('throws when there is no authenticated user', async () => {
    buildMockSupabase({ authUser: null })

    await expect(requireAdmin()).rejects.toThrow()
  })

  it('throws with "Unauthorized" message when unauthenticated', async () => {
    buildMockSupabase({ authUser: null })

    await expect(requireAdmin()).rejects.toThrow('Unauthorized')
  })

  it('throws with "Forbidden" message when the user is not an admin', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: makeProfile({ role: 'user' }) })

    await expect(requireAdmin()).rejects.toThrow('Forbidden')
  })

  it('throws when the profile row is null even though user exists', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: null })

    await expect(requireAdmin()).rejects.toThrow('Forbidden')
  })

  it('throws an Error instance (not a plain string)', async () => {
    buildMockSupabase({ authUser: null })

    await expect(requireAdmin()).rejects.toBeInstanceOf(Error)
  })

  it('does NOT throw when the user has admin role', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: makeProfile({ role: 'admin' }) })

    await expect(requireAdmin()).resolves.not.toThrow()
  })

  it('the Unauthorized error message contains Hungarian text', async () => {
    buildMockSupabase({ authUser: null })

    await expect(requireAdmin()).rejects.toThrow('bejelentkezés szükséges')
  })

  it('the Forbidden error message contains Hungarian text', async () => {
    buildMockSupabase({ authUser: makeUser(), profileData: makeProfile({ role: 'user' }) })

    await expect(requireAdmin()).rejects.toThrow('admin jogosultság szükséges')
  })
})

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

describe('getSession', () => {
  beforeEach(() => {
    mockCreateClient.mockReset()
  })

  it('returns the session object when a valid session exists', async () => {
    const user = makeUser()
    const session = makeSession(user)
    buildMockSupabase({ sessionData: session })

    const result = await getSession()

    expect(result).toBe(session)
  })

  it('returns null when there is no active session', async () => {
    buildMockSupabase({ sessionData: null })

    const result = await getSession()

    expect(result).toBeNull()
  })

  it('uses createClient exactly once per call', async () => {
    buildMockSupabase({ sessionData: null })

    await getSession()

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
  })

  it('calls auth.getSession() (not auth.getUser())', async () => {
    const { getSessionMock, getUserMock } = buildMockSupabase({ sessionData: null })

    await getSession()

    expect(getSessionMock).toHaveBeenCalledTimes(1)
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('returns a Session with an access_token when session exists', async () => {
    const session = makeSession(makeUser())
    buildMockSupabase({ sessionData: session })

    const result = await getSession()

    expect(result?.access_token).toBe('access-token-abc')
  })
})
