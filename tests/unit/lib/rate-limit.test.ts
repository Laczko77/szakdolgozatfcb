import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { consumeToken, getClientKey } from '@/lib/rate-limit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a unique key to avoid state pollution between tests.
 * The module-level `buckets` Map persists across the entire test run,
 * so every test must use its own distinct key.
 */
let _seq = 0;
function uniqueKey(prefix = 'test'): string {
  _seq += 1;
  return `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2)}-${_seq}`;
}

// ---------------------------------------------------------------------------
// consumeToken
// ---------------------------------------------------------------------------

describe('consumeToken', () => {
  describe('misconfiguration passthrough', () => {
    it('returns allowed:true when capacity is 0', () => {
      const result = consumeToken(uniqueKey(), { capacity: 0, refillPerSecond: 1 });
      expect(result).toEqual({ allowed: true, remaining: 0, retryAfter: 0 });
    });

    it('returns allowed:true when capacity is negative', () => {
      const result = consumeToken(uniqueKey(), { capacity: -5, refillPerSecond: 1 });
      expect(result).toEqual({ allowed: true, remaining: -5, retryAfter: 0 });
    });

    it('returns allowed:true when refillPerSecond is 0', () => {
      const result = consumeToken(uniqueKey(), { capacity: 10, refillPerSecond: 0 });
      expect(result).toEqual({ allowed: true, remaining: 10, retryAfter: 0 });
    });

    it('returns allowed:true when refillPerSecond is negative', () => {
      const result = consumeToken(uniqueKey(), { capacity: 10, refillPerSecond: -1 });
      expect(result).toEqual({ allowed: true, remaining: 10, retryAfter: 0 });
    });

    it('returns allowed:true when both capacity and refillPerSecond are 0', () => {
      const result = consumeToken(uniqueKey(), { capacity: 0, refillPerSecond: 0 });
      expect(result).toEqual({ allowed: true, remaining: 0, retryAfter: 0 });
    });
  });

  describe('new bucket — first call', () => {
    it('allows the first request on a brand-new key', () => {
      const result = consumeToken(uniqueKey(), { capacity: 5, refillPerSecond: 1 });
      expect(result.allowed).toBe(true);
    });

    it('returns retryAfter of 0 when allowed', () => {
      const result = consumeToken(uniqueKey(), { capacity: 5, refillPerSecond: 1 });
      expect(result.retryAfter).toBe(0);
    });

    it('remaining is capacity - 1 after the first call', () => {
      const result = consumeToken(uniqueKey(), { capacity: 5, refillPerSecond: 1 });
      expect(result.remaining).toBe(4);
    });

    it('remaining is 0 after the first call on a capacity=1 bucket', () => {
      const result = consumeToken(uniqueKey(), { capacity: 1, refillPerSecond: 1 });
      expect(result.remaining).toBe(0);
    });
  });

  describe('token exhaustion', () => {
    it('allows exactly capacity calls, then blocks the next one', () => {
      const key = uniqueKey('exhaust');
      const opts = { capacity: 3, refillPerSecond: 1 };

      const r1 = consumeToken(key, opts);
      const r2 = consumeToken(key, opts);
      const r3 = consumeToken(key, opts);
      const r4 = consumeToken(key, opts);

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
      expect(r3.allowed).toBe(true);
      expect(r4.allowed).toBe(false);
    });

    it('remaining decrements correctly across multiple calls', () => {
      const key = uniqueKey('remaining');
      const opts = { capacity: 3, refillPerSecond: 1 };

      const r1 = consumeToken(key, opts);
      const r2 = consumeToken(key, opts);
      const r3 = consumeToken(key, opts);

      expect(r1.remaining).toBe(2);
      expect(r2.remaining).toBe(1);
      expect(r3.remaining).toBe(0);
    });

    it('blocked result has remaining of 0', () => {
      const key = uniqueKey('blocked-remaining');
      const opts = { capacity: 1, refillPerSecond: 1 };

      consumeToken(key, opts); // consume the only token
      const blocked = consumeToken(key, opts);

      expect(blocked.remaining).toBe(0);
    });

    it('blocked result has retryAfter >= 1', () => {
      const key = uniqueKey('retry-after');
      const opts = { capacity: 1, refillPerSecond: 1 };

      consumeToken(key, opts); // consume the only token
      const blocked = consumeToken(key, opts);

      expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
    });

    it('retryAfter is a whole number (ceiling)', () => {
      const key = uniqueKey('ceiling');
      const opts = { capacity: 1, refillPerSecond: 1 };

      consumeToken(key, opts);
      const blocked = consumeToken(key, opts);

      expect(Number.isInteger(blocked.retryAfter)).toBe(true);
    });

    it('allowed is false on the blocked call', () => {
      const key = uniqueKey('allowed-false');
      const opts = { capacity: 2, refillPerSecond: 1 };

      consumeToken(key, opts);
      consumeToken(key, opts);
      const blocked = consumeToken(key, opts);

      expect(blocked.allowed).toBe(false);
    });
  });

  describe('time-based refill (fake timers)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('refills tokens after enough time has elapsed', () => {
      const key = uniqueKey('refill');
      const opts = { capacity: 1, refillPerSecond: 1 };

      // Consume the only token.
      const first = consumeToken(key, opts);
      expect(first.allowed).toBe(true);

      // Bucket is now empty — next immediate call is blocked.
      const blocked = consumeToken(key, opts);
      expect(blocked.allowed).toBe(false);

      // Advance time by 1.1 seconds so the bucket refills.
      vi.advanceTimersByTime(1100);

      // Should be allowed again.
      const afterRefill = consumeToken(key, opts);
      expect(afterRefill.allowed).toBe(true);
    });

    it('does not refill tokens before enough time has elapsed', () => {
      const key = uniqueKey('no-refill-yet');
      const opts = { capacity: 1, refillPerSecond: 1 };

      consumeToken(key, opts); // consume
      vi.advanceTimersByTime(500); // only half a second — not enough to refill

      const result = consumeToken(key, opts);
      expect(result.allowed).toBe(false);
    });

    it('caps refilled tokens at capacity', () => {
      const key = uniqueKey('cap-refill');
      const opts = { capacity: 3, refillPerSecond: 2 };

      // Drain the bucket completely.
      consumeToken(key, opts);
      consumeToken(key, opts);
      consumeToken(key, opts);

      // Advance far more than needed to refill (10 s would give 20 tokens, but
      // capacity is 3, so remaining must be capped at 2 after consuming 1).
      vi.advanceTimersByTime(10_000);

      const result = consumeToken(key, opts);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2); // capacity(3) - 1 consumed = 2
    });

    it('partial refill — fractional refillPerSecond', () => {
      const key = uniqueKey('fractional');
      // 1 token every 2 seconds.
      const opts = { capacity: 2, refillPerSecond: 0.5 };

      consumeToken(key, opts); // remaining: 1
      consumeToken(key, opts); // remaining: 0, bucket empty

      // After 2 seconds exactly, 1 token should have been added.
      vi.advanceTimersByTime(2000);

      const result = consumeToken(key, opts);
      expect(result.allowed).toBe(true);
    });

    it('retryAfter reflects seconds until next token when refillPerSecond is slow', () => {
      const key = uniqueKey('retry-slow');
      // 0.5 tokens/s → 2 s per token
      const opts = { capacity: 1, refillPerSecond: 0.5 };

      consumeToken(key, opts); // drain
      const blocked = consumeToken(key, opts);

      // deficit = 1 token, refillPerSecond = 0.5 → ceil(1/0.5) = 2
      expect(blocked.retryAfter).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// getClientKey
// ---------------------------------------------------------------------------

describe('getClientKey', () => {
  function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request('https://example.com/api/test', { headers });
  }

  describe('authenticated user', () => {
    it('returns "user:{userId}" when userId is provided', () => {
      const req = makeRequest();
      expect(getClientKey(req, 'abc123')).toBe('user:abc123');
    });

    it('prefers userId over X-Forwarded-For when both present', () => {
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4' });
      expect(getClientKey(req, 'user-wins')).toBe('user:user-wins');
    });

    it('prefers userId over x-real-ip when both present', () => {
      const req = makeRequest({ 'x-real-ip': '5.6.7.8' });
      expect(getClientKey(req, 'user-wins-again')).toBe('user:user-wins-again');
    });

    it('works with a UUID-style userId', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(getClientKey(makeRequest(), uuid)).toBe(`user:${uuid}`);
    });
  });

  describe('X-Forwarded-For header', () => {
    it('returns "ip:{ip}" when X-Forwarded-For has a single IP', () => {
      const req = makeRequest({ 'x-forwarded-for': '10.0.0.1' });
      expect(getClientKey(req, null)).toBe('ip:10.0.0.1');
    });

    it('returns the first IP when X-Forwarded-For has multiple comma-separated IPs', () => {
      const req = makeRequest({ 'x-forwarded-for': '192.168.1.1, 10.0.0.2, 172.16.0.3' });
      expect(getClientKey(req, null)).toBe('ip:192.168.1.1');
    });

    it('trims whitespace from the first IP in X-Forwarded-For', () => {
      const req = makeRequest({ 'x-forwarded-for': '  203.0.113.5  , 198.51.100.1' });
      expect(getClientKey(req, null)).toBe('ip:203.0.113.5');
    });

    it('prefers X-Forwarded-For over x-real-ip when both present', () => {
      const req = makeRequest({
        'x-forwarded-for': '11.22.33.44',
        'x-real-ip': '99.88.77.66',
      });
      expect(getClientKey(req, null)).toBe('ip:11.22.33.44');
    });
  });

  describe('x-real-ip header', () => {
    it('returns "ip:{ip}" when only x-real-ip is present', () => {
      const req = makeRequest({ 'x-real-ip': '172.16.0.1' });
      expect(getClientKey(req, null)).toBe('ip:172.16.0.1');
    });

    it('trims whitespace from x-real-ip', () => {
      const req = makeRequest({ 'x-real-ip': '  8.8.8.8  ' });
      expect(getClientKey(req, null)).toBe('ip:8.8.8.8');
    });
  });

  describe('anonymous fallback', () => {
    it('returns "anon:shared" when no userId and no IP headers', () => {
      const req = makeRequest();
      expect(getClientKey(req, null)).toBe('anon:shared');
    });

    it('returns "anon:shared" when userId is null and headers are empty', () => {
      const req = makeRequest({});
      expect(getClientKey(req, null)).toBe('anon:shared');
    });
  });
});
