import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks required before importing the route module (which imports next/server,
// supabase, and api-utils at module-load time).
// ---------------------------------------------------------------------------
vi.mock('next/server', () => ({
  NextResponse: { json: vi.fn() },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/api-utils', () => ({
  requireAdminApi: vi.fn(),
  errorResponse: vi.fn(),
  successResponse: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import the pure helpers under test.
// ---------------------------------------------------------------------------
import {
  DEFAULT_NONE_OPTION_TEXT,
  parseOptions,
  applyNoneOption,
} from '@/app/api/admin/polls/route'
import type { PollOption } from '@/types/database'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const opts: PollOption[] = [{ label: 'A' }, { label: 'B' }]
const optsWithNone: PollOption[] = [
  { label: 'A' },
  { label: 'B' },
  { label: 'Más', is_none: true },
]
const optsTwoNone: PollOption[] = [
  { label: 'A', is_none: true },
  { label: 'B', is_none: true },
]

// ---------------------------------------------------------------------------
// DEFAULT_NONE_OPTION_TEXT
// ---------------------------------------------------------------------------
describe('DEFAULT_NONE_OPTION_TEXT', () => {
  it("equals 'Más / Egyik sem'", () => {
    expect(DEFAULT_NONE_OPTION_TEXT).toBe('Más / Egyik sem')
  })
})

// ---------------------------------------------------------------------------
// parseOptions
// ---------------------------------------------------------------------------
describe('parseOptions', () => {
  // Non-array inputs
  it('returns Error for null', () => {
    const result = parseOptions(null)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for a string', () => {
    const result = parseOptions('string')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for a number', () => {
    const result = parseOptions(42)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for an object', () => {
    const result = parseOptions({ label: 'A' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error message indicating "tömbnek kell lennie" for non-array', () => {
    const result = parseOptions(null) as Error
    expect(result.message).toContain('tömbnek kell lennie')
  })

  // Insufficient length
  it('returns Error for empty array', () => {
    const result = parseOptions([])
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for single-element array', () => {
    const result = parseOptions(['csak egy'])
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error message indicating "Legalább 2" for short arrays', () => {
    const result = parseOptions(['csak egy']) as Error
    expect(result.message).toContain('Legalább 2')
  })

  // Valid string arrays
  it('returns PollOption[] for two valid strings', () => {
    const result = parseOptions(['A', 'B'])
    expect(result).toEqual([{ label: 'A' }, { label: 'B' }])
  })

  it('trims whitespace from string elements', () => {
    const result = parseOptions(['  A  ', '  B  '])
    expect(result).toEqual([{ label: 'A' }, { label: 'B' }])
  })

  // Invalid string elements
  it('returns Error for empty string element', () => {
    const result = parseOptions(['', 'B'])
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for whitespace-only string element', () => {
    const result = parseOptions(['   ', 'B'])
    expect(result).toBeInstanceOf(Error)
  })

  // Valid object arrays
  it('returns PollOption[] for two valid label objects', () => {
    const result = parseOptions([{ label: 'A' }, { label: 'B' }])
    expect(result).toEqual([{ label: 'A' }, { label: 'B' }])
  })

  it('trims whitespace from object label', () => {
    const result = parseOptions([{ label: '  A  ' }, { label: 'B' }])
    expect(result).toEqual([{ label: 'A' }, { label: 'B' }])
  })

  // Invalid object elements
  it('returns Error for object with empty label', () => {
    const result = parseOptions([{ label: '' }, { label: 'B' }])
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for object missing label', () => {
    const result = parseOptions([{ value: 'A' }, { label: 'B' }])
    expect(result).toBeInstanceOf(Error)
  })

  // Invalid element types
  it('returns Error when one element is null', () => {
    const result = parseOptions([{ label: 'A' }, null])
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error when one element is a number', () => {
    const result = parseOptions([{ label: 'A' }, 42])
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error when one element is an array', () => {
    const result = parseOptions([{ label: 'A' }, []])
    expect(result).toBeInstanceOf(Error)
  })

  // Mixed string/object arrays
  it('handles mixed string and object elements', () => {
    const result = parseOptions(['A', { label: 'B' }])
    expect(result).toEqual([{ label: 'A' }, { label: 'B' }])
  })

  // Extra fields on object elements are preserved
  it('preserves extra fields on object elements (e.g. is_none)', () => {
    const result = parseOptions([{ label: 'A', is_none: true }, { label: 'B' }])
    expect(result).not.toBeInstanceOf(Error)
    const arr = result as PollOption[]
    expect(arr[0].is_none).toBe(true)
    expect(arr[0].label).toBe('A')
    expect(arr[1].label).toBe('B')
  })

  // Return type is always an array of PollOption when successful
  it('returns an array with the correct length', () => {
    const result = parseOptions(['A', 'B', 'C'])
    expect(result).not.toBeInstanceOf(Error)
    expect((result as PollOption[]).length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// applyNoneOption
// ---------------------------------------------------------------------------
describe('applyNoneOption', () => {
  // Pass-through cases (undefined / null / false)
  it('returns options unchanged when addNoneOptionRaw is undefined', () => {
    const result = applyNoneOption(opts, undefined, undefined)
    expect(result).toBe(opts)
  })

  it('returns options unchanged when addNoneOptionRaw is null', () => {
    const result = applyNoneOption(opts, null, null)
    expect(result).toBe(opts)
  })

  it('returns options unchanged when addNoneOptionRaw is false', () => {
    const result = applyNoneOption(opts, false, undefined)
    expect(result).toBe(opts)
  })

  // Non-boolean addNoneOptionRaw → Error
  it('returns Error when addNoneOptionRaw is a string "true"', () => {
    const result = applyNoneOption(opts, 'true', undefined)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error when addNoneOptionRaw is the number 1', () => {
    const result = applyNoneOption(opts, 1, undefined)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error when addNoneOptionRaw is an object', () => {
    const result = applyNoneOption(opts, {}, undefined)
    expect(result).toBeInstanceOf(Error)
  })

  it('Error message mentions "logikai értéknek kell lennie" for non-boolean', () => {
    const result = applyNoneOption(opts, 'true', undefined) as Error
    expect(result.message).toContain('logikai értéknek kell lennie')
  })

  // addNoneOptionRaw === true, no existing none → appends default label
  it('appends { label: DEFAULT_NONE_OPTION_TEXT, is_none: true } when addNoneOptionRaw is true', () => {
    const result = applyNoneOption(opts, true, undefined)
    expect(result).not.toBeInstanceOf(Error)
    const arr = result as PollOption[]
    expect(arr).toEqual([
      { label: 'A' },
      { label: 'B' },
      { label: DEFAULT_NONE_OPTION_TEXT, is_none: true },
    ])
  })

  it('appended none option is at the last position', () => {
    const result = applyNoneOption(opts, true, undefined) as PollOption[]
    expect(result.length).toBe(3)
    expect(result[result.length - 1].is_none).toBe(true)
  })

  it('does not mutate the original options array', () => {
    const original = [{ label: 'A' }, { label: 'B' }]
    const result = applyNoneOption(original, true, undefined) as PollOption[]
    expect(result).not.toBe(original)
    expect(original.length).toBe(2)
  })

  // Custom noneOptionTextRaw
  it('uses custom label when noneOptionTextRaw is provided', () => {
    const result = applyNoneOption(opts, true, 'Nem tudom') as PollOption[]
    expect(result[result.length - 1]).toEqual({ label: 'Nem tudom', is_none: true })
  })

  it('trims whitespace from custom noneOptionTextRaw', () => {
    const result = applyNoneOption(opts, true, '  Nem tudom  ') as PollOption[]
    expect(result[result.length - 1].label).toBe('Nem tudom')
  })

  // Invalid noneOptionTextRaw
  it('returns Error when noneOptionTextRaw is an empty string', () => {
    const result = applyNoneOption(opts, true, '')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error when noneOptionTextRaw is whitespace-only', () => {
    const result = applyNoneOption(opts, true, '  ')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error when noneOptionTextRaw is a number', () => {
    const result = applyNoneOption(opts, true, 123)
    expect(result).toBeInstanceOf(Error)
  })

  it('Error message mentions "none_option_text" for invalid text', () => {
    const result = applyNoneOption(opts, true, '') as Error
    expect(result.message).toContain('none_option_text')
  })

  // Duplicate none entries
  it('returns Error when options already contain one is_none entry and addNoneOptionRaw is true', () => {
    const result = applyNoneOption(optsWithNone, true, undefined)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns optsWithNone unchanged when addNoneOptionRaw is false (one existing is_none)', () => {
    const result = applyNoneOption(optsWithNone, false, undefined)
    expect(result).toBe(optsWithNone)
  })

  it('returns optsWithNone unchanged when addNoneOptionRaw is undefined (one existing is_none)', () => {
    const result = applyNoneOption(optsWithNone, undefined, undefined)
    expect(result).toBe(optsWithNone)
  })

  // Two existing none entries → always Error (checked before the flag test)
  it('returns Error immediately when two is_none entries already exist, even with addNoneOptionRaw true', () => {
    const result = applyNoneOption(optsTwoNone, true, undefined)
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error immediately when two is_none entries already exist, even with addNoneOptionRaw false', () => {
    const result = applyNoneOption(optsTwoNone, false, undefined)
    expect(result).toBeInstanceOf(Error)
  })

  it('Error message mentions "Csak egy" for multiple none entries', () => {
    const result = applyNoneOption(optsTwoNone, false, undefined) as Error
    expect(result.message).toContain('Csak egy')
  })
})
