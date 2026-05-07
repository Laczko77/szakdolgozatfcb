import { describe, it, expect, vi } from 'vitest';

vi.mock('@/types/database', () => ({}));

import { ownReactionKey } from '@/types/social';

describe('ownReactionKey', () => {
  // --- basic happy path ---

  it('returns "post:abc-123" for targetType "post" and targetId "abc-123"', () => {
    expect(ownReactionKey('post', 'abc-123')).toBe('post:abc-123');
  });

  it('returns "comment:xyz-789" for targetType "comment" and targetId "xyz-789"', () => {
    expect(ownReactionKey('comment', 'xyz-789')).toBe('comment:xyz-789');
  });

  // --- empty targetId ---

  it('returns "post:" when targetId is an empty string', () => {
    expect(ownReactionKey('post', '')).toBe('post:');
  });

  it('returns "comment:" when targetId is an empty string', () => {
    expect(ownReactionKey('comment', '')).toBe('comment:');
  });

  // --- UUID targetId ---

  it('handles a UUID targetId and produces the correct "post:" prefix', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(ownReactionKey('post', uuid)).toBe(`post:${uuid}`);
  });

  it('handles a UUID targetId and produces the correct "comment:" prefix', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(ownReactionKey('comment', uuid)).toBe(`comment:${uuid}`);
  });

  // --- different targetTypes produce different keys for the same targetId ---

  it('produces different keys for "post" vs "comment" with the same targetId', () => {
    const id = 'same-id-42';
    const postKey = ownReactionKey('post', id);
    const commentKey = ownReactionKey('comment', id);
    expect(postKey).not.toBe(commentKey);
  });

  // --- format invariants ---

  it('always contains a colon separator', () => {
    expect(ownReactionKey('post', 'any-id')).toContain(':');
    expect(ownReactionKey('comment', 'any-id')).toContain(':');
  });

  it('starts with "post:" when targetType is "post"', () => {
    expect(ownReactionKey('post', 'some-id')).toMatch(/^post:/);
  });

  it('starts with "comment:" when targetType is "comment"', () => {
    expect(ownReactionKey('comment', 'some-id')).toMatch(/^comment:/);
  });

  it('ends with the targetId', () => {
    const id = 'my-target-id';
    expect(ownReactionKey('post', id).endsWith(id)).toBe(true);
    expect(ownReactionKey('comment', id).endsWith(id)).toBe(true);
  });

  // --- return type ---

  it('returns a string', () => {
    expect(typeof ownReactionKey('post', 'abc')).toBe('string');
    expect(typeof ownReactionKey('comment', 'abc')).toBe('string');
  });

  // --- numeric-like and special character targetIds ---

  it('handles a numeric string targetId', () => {
    expect(ownReactionKey('post', '12345')).toBe('post:12345');
  });

  it('handles a targetId containing colons (no ambiguity introduced in prefix)', () => {
    // The function just concatenates; the "post:" prefix is always the first segment
    const result = ownReactionKey('post', 'a:b');
    expect(result).toBe('post:a:b');
    expect(result.startsWith('post:')).toBe(true);
  });
});
