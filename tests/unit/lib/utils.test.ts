import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn', () => {
  it('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('')
  })

  it('returns a single class name unchanged', () => {
    expect(cn('font-bold')).toBe('font-bold')
  })

  it('joins multiple class names with a space', () => {
    expect(cn('flex', 'items-center', 'gap-4')).toBe('flex items-center gap-4')
  })

  it('filters out undefined values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b')
  })

  it('filters out null values', () => {
    expect(cn('a', null, 'b')).toBe('a b')
  })

  it('filters out false from short-circuit expressions', () => {
    // false && 'b' evaluates to false — should be excluded
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })

  it('includes the class when the condition is true', () => {
    expect(cn('a', true && 'b', 'c')).toBe('a b c')
  })

  it('resolves Tailwind padding conflicts — later class wins', () => {
    // tailwind-merge removes p-4 in favour of the later p-2
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })

  it('resolves Tailwind text-color conflicts — later class wins', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('resolves Tailwind margin conflicts — later class wins', () => {
    expect(cn('m-4', 'm-8')).toBe('m-8')
  })

  it('keeps unrelated classes alongside a conflicting pair', () => {
    // flex is unrelated and must be preserved
    expect(cn('flex', 'text-sm', 'text-lg')).toBe('flex text-lg')
  })

  it('accepts an object with boolean values (clsx syntax)', () => {
    expect(cn({ 'font-bold': true, italic: false })).toBe('font-bold')
  })

  it('accepts an array of class names (clsx syntax)', () => {
    expect(cn(['px-2', 'py-1'])).toBe('px-2 py-1')
  })

  it('handles a mix of strings, arrays, and objects', () => {
    expect(cn('flex', ['gap-2'], { 'font-bold': true })).toBe('flex gap-2 font-bold')
  })
})
