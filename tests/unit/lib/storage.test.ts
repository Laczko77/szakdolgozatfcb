// vi.mock calls are hoisted by Vitest before imports, so this mock prevents
// `createServiceRoleClient` (called at module level in storage.ts) from
// throwing due to missing Supabase env vars in the Node test environment.
import { vi, describe, it, expect } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createServiceRoleClient: vi.fn(),
}))

import { fileNameFromUrl } from '@/lib/storage'

describe('fileNameFromUrl', () => {
  // --- Valid URLs (parsed via `new URL`) ---

  it('extracts the filename from a Supabase storage public URL', () => {
    expect(
      fileNameFromUrl(
        'https://abc.supabase.co/storage/v1/object/public/profile-images/avatar.jpg'
      )
    ).toBe('avatar.jpg')
  })

  it('extracts the filename from a simple URL with a single path segment', () => {
    expect(fileNameFromUrl('https://example.com/photo.png')).toBe('photo.png')
  })

  it('extracts the last segment from a deeply nested path', () => {
    expect(fileNameFromUrl('https://example.com/a/b/c/file.txt')).toBe(
      'file.txt'
    )
  })

  it('extracts a segment that has no file extension', () => {
    expect(fileNameFromUrl('https://example.com/path/uuid-string')).toBe(
      'uuid-string'
    )
  })

  it('excludes query string from the returned filename (pathname does not include query)', () => {
    // URL.pathname does not include the query string, so the query is stripped.
    expect(fileNameFromUrl('https://example.com/file.jpg?v=123')).toBe(
      'file.jpg'
    )
  })

  it('returns the directory name for a URL with a trailing slash (filter removes the trailing empty segment)', () => {
    // pathname is "/files/"; split gives ['', 'files', '']; filter(Boolean) → ['files']
    // so the last meaningful segment is 'files', not empty.
    expect(fileNameFromUrl('https://example.com/files/')).toBe('files')
  })

  it('returns empty string for a URL with only the root slash and no path segments', () => {
    // pathname is "/"; split gives ['', '']; filter(Boolean) → []; segments[-1] is
    // undefined → nullish-coalescing returns ''.
    expect(fileNameFromUrl('https://example.com/')).toBe('')
  })

  // --- Invalid URLs (fallback via lastIndexOf('/')) ---

  it('falls back to last slash segment for a relative-like path without a protocol', () => {
    expect(fileNameFromUrl('some/path/image.jpg')).toBe('image.jpg')
  })

  it('returns the whole string when there is no slash and the input is not a valid URL', () => {
    expect(fileNameFromUrl('justfilename.jpg')).toBe('justfilename.jpg')
  })

  it('returns empty string for an empty string input', () => {
    expect(fileNameFromUrl('')).toBe('')
  })

  // --- Return type ---

  it('always returns a string', () => {
    expect(typeof fileNameFromUrl('https://example.com/file.png')).toBe(
      'string'
    )
    expect(typeof fileNameFromUrl('')).toBe('string')
    expect(typeof fileNameFromUrl('no-slashes')).toBe('string')
  })
})
