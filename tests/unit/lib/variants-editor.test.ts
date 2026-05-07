import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks for UI dependencies that would fail in a Node environment.
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  Plus: () => null,
  Trash2: () => null,
}))

vi.mock('@/components/admin/AdminButton', () => ({
  AdminButton: () => null,
}))

vi.mock('@/components/admin/AdminInput', () => ({
  AdminInput: () => null,
}))

// ---------------------------------------------------------------------------
// Import pure helpers under test (React component is intentionally excluded).
// ---------------------------------------------------------------------------
import { makeEmptyVariant, type VariantDraft } from '@/components/admin/products/VariantsEditor'

// ---------------------------------------------------------------------------
// makeEmptyVariant
// ---------------------------------------------------------------------------
describe('makeEmptyVariant', () => {
  it('returns an object with size === ""', () => {
    const v = makeEmptyVariant()
    expect(v.size).toBe('')
  })

  it('returns an object with color === ""', () => {
    const v = makeEmptyVariant()
    expect(v.color).toBe('')
  })

  it('returns an object with stock === 0', () => {
    const v = makeEmptyVariant()
    expect(v.stock).toBe(0)
  })

  it('returns an object without an id property (undefined)', () => {
    const v = makeEmptyVariant()
    expect(v.id).toBeUndefined()
  })

  it('_key is a string', () => {
    const v = makeEmptyVariant()
    expect(typeof v._key).toBe('string')
  })

  it('_key starts with "v_"', () => {
    const v = makeEmptyVariant()
    expect(v._key.startsWith('v_')).toBe(true)
  })

  it('successive calls produce different _key values', () => {
    const a = makeEmptyVariant()
    const b = makeEmptyVariant()
    expect(a._key).not.toBe(b._key)
  })

  it('three successive calls all produce distinct _key values', () => {
    const keys = [makeEmptyVariant()._key, makeEmptyVariant()._key, makeEmptyVariant()._key]
    const unique = new Set(keys)
    expect(unique.size).toBe(3)
  })

  it('returns a VariantDraft-compatible structure with all required fields', () => {
    const v = makeEmptyVariant()
    // Check every required field of VariantDraft is present
    expect(Object.prototype.hasOwnProperty.call(v, 'size')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(v, 'color')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(v, 'stock')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(v, '_key')).toBe(true)
  })

  it('stock is a number (not the empty-string union branch)', () => {
    const v = makeEmptyVariant()
    expect(typeof v.stock).toBe('number')
  })

  it('satisfies the VariantDraft type shape at runtime', () => {
    // TypeScript compile-time check via assignment — if it compiles, the shape is correct.
    const v: VariantDraft = makeEmptyVariant()
    expect(v).toBeDefined()
  })
})
