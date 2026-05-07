import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

import { deriveMatchStatus } from '@/components/tickets/MatchStatusBadge';

const NOW = new Date('2025-06-01T12:00:00Z').getTime();

describe('deriveMatchStatus', () => {
  // --- invalid input ---

  it('returns "past" for a non-date string', () => {
    expect(deriveMatchStatus('nem-datum', NOW)).toBe('past');
  });

  it('returns "past" for an empty string', () => {
    expect(deriveMatchStatus('', NOW)).toBe('past');
  });

  it('returns "past" for a clearly garbage string', () => {
    expect(deriveMatchStatus('not-a-date-at-all', NOW)).toBe('past');
  });

  // --- past dates ---

  it('returns "past" for a date 31 days in the past', () => {
    expect(deriveMatchStatus('2025-05-01T12:00:00Z', NOW)).toBe('past');
  });

  it('returns "past" for a date 1 ms before now', () => {
    const msBeforeNow = new Date(NOW - 1).toISOString();
    expect(deriveMatchStatus(msBeforeNow, NOW)).toBe('past');
  });

  it('returns "past" for a date far in the past', () => {
    expect(deriveMatchStatus('2000-01-01T00:00:00Z', NOW)).toBe('past');
  });

  // --- boundary: t === now ---

  it('returns "available" when t === now (0 days, 0 <= 60)', () => {
    const exactNow = new Date(NOW).toISOString();
    expect(deriveMatchStatus(exactNow, NOW)).toBe('available');
  });

  // --- boundary: t = now + 1 ms ---

  it('returns "available" when t is 1 ms in the future (~0 days)', () => {
    const justAfterNow = new Date(NOW + 1).toISOString();
    expect(deriveMatchStatus(justAfterNow, NOW)).toBe('available');
  });

  // --- available window (default 60 days) ---

  it('returns "available" for a date 30 days in the future', () => {
    expect(deriveMatchStatus('2025-07-01T12:00:00Z', NOW)).toBe('available');
  });

  it('returns "available" for a date exactly 60 days in the future (boundary <=)', () => {
    const exactly60Days = new Date(NOW + 60 * 86_400_000).toISOString();
    expect(deriveMatchStatus(exactly60Days, NOW)).toBe('available');
  });

  // --- soon ---

  it('returns "soon" for a date 61 days in the future (one day past window)', () => {
    const sixtyOneDays = new Date(NOW + 61 * 86_400_000).toISOString();
    expect(deriveMatchStatus(sixtyOneDays, NOW)).toBe('soon');
  });

  it('returns "soon" for a date 90 days in the future', () => {
    expect(deriveMatchStatus('2025-08-30T12:00:00Z', NOW)).toBe('soon');
  });

  it('returns "soon" for a date 1 year in the future', () => {
    expect(deriveMatchStatus('2026-06-01T12:00:00Z', NOW)).toBe('soon');
  });

  // --- custom availableWindowDays ---

  it('returns "available" for 20-day future date with custom window of 30 days', () => {
    const twentyDays = new Date(NOW + 20 * 86_400_000).toISOString();
    expect(deriveMatchStatus(twentyDays, NOW, 30)).toBe('available');
  });

  it('returns "soon" for 40-day future date with custom window of 30 days', () => {
    const fortyDays = new Date(NOW + 40 * 86_400_000).toISOString();
    expect(deriveMatchStatus(fortyDays, NOW, 30)).toBe('soon');
  });

  it('returns "soon" for any future date when availableWindowDays = 0', () => {
    const tomorrow = new Date(NOW + 86_400_000).toISOString();
    expect(deriveMatchStatus(tomorrow, NOW, 0)).toBe('soon');
  });

  it('returns "soon" for a 1-ms future date when availableWindowDays = 0 (days > 0 is false only at exactly 0)', () => {
    // days = 1ms / 86_400_000 ≈ 0.0000115..., which is > 0, so "soon"
    const justFuture = new Date(NOW + 1).toISOString();
    expect(deriveMatchStatus(justFuture, NOW, 0)).toBe('soon');
  });

  // --- return type invariant ---

  it('always returns one of the three MatchStatusKind literals', () => {
    const validKinds = ['available', 'soon', 'past'];
    const cases = [
      deriveMatchStatus('2025-05-01T00:00:00Z', NOW),
      deriveMatchStatus('2025-07-01T00:00:00Z', NOW),
      deriveMatchStatus('2025-08-30T00:00:00Z', NOW),
    ];
    for (const result of cases) {
      expect(validKinds).toContain(result);
    }
  });

  // --- default now parameter ---

  it('is callable without the now parameter and returns a MatchStatusKind', () => {
    const validKinds = ['available', 'soon', 'past'];
    // Use a date far in the future so the result is deterministic
    const result = deriveMatchStatus('2099-12-31T00:00:00Z');
    expect(validKinds).toContain(result);
  });
});
