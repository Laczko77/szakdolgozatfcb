// @vitest-environment jsdom
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedPolling } from '@/hooks/useFeedPolling';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Advance fake timers AND flush React state updates in one step. */
async function advanceTimers(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Make document.visibilityState writable for the duration of a test. */
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

const INTERVAL = 1000; // ms — fast interval for test speed

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  // Reset visibility to 'visible' so subsequent tests start clean.
  setVisibility('visible');
});

// ---------------------------------------------------------------------------
// Basic polling
// ---------------------------------------------------------------------------

describe('useFeedPolling — basic polling', () => {
  it('does not call onTick before the first interval elapses', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    await advanceTimers(INTERVAL - 1);

    expect(onTick).not.toHaveBeenCalled();
  });

  it('calls onTick exactly once after one interval elapses', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    await advanceTimers(INTERVAL);

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('calls onTick three times after three intervals', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    await advanceTimers(INTERVAL * 3);

    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('passes an ISO-8601 string as the "since" argument', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    await advanceTimers(INTERVAL);

    const since = (onTick as Mock).mock.calls[0][0] as string;
    expect(since).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

// ---------------------------------------------------------------------------
// enabled flag
// ---------------------------------------------------------------------------

describe('useFeedPolling — enabled flag', () => {
  it('does not call onTick when enabled=false', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useFeedPolling(onTick, { intervalMs: INTERVAL, enabled: false }),
    );

    await advanceTimers(INTERVAL * 5);

    expect(onTick).not.toHaveBeenCalled();
  });

  it('stops calling onTick after enabled switches to false', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    let enabled = true;
    const { rerender } = renderHook(() =>
      useFeedPolling(onTick, { intervalMs: INTERVAL, enabled }),
    );

    // One successful tick.
    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(1);

    // Disable and verify no more ticks.
    enabled = false;
    rerender();

    await advanceTimers(INTERVAL * 3);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('resumes polling after enabled switches back to true', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    let enabled = false;
    const { rerender } = renderHook(() =>
      useFeedPolling(onTick, { intervalMs: INTERVAL, enabled }),
    );

    await advanceTimers(INTERVAL * 2);
    expect(onTick).not.toHaveBeenCalled();

    enabled = true;
    rerender();

    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('stops all polling after unmount', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useFeedPolling(onTick, { intervalMs: INTERVAL }),
    );

    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(1);

    unmount();

    await advanceTimers(INTERVAL * 5);
    // Still only the one call from before unmount.
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Visibility gate
// ---------------------------------------------------------------------------

describe('useFeedPolling — visibility gate', () => {
  it('skips ticks while the document is hidden', async () => {
    setVisibility('hidden');
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    await advanceTimers(INTERVAL * 5);

    expect(onTick).not.toHaveBeenCalled();
  });

  it('resumes polling when document becomes visible again', async () => {
    setVisibility('hidden');
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    // No ticks while hidden.
    await advanceTimers(INTERVAL * 2);
    expect(onTick).not.toHaveBeenCalled();

    // Become visible and fire the visibilitychange event.
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      // Allow the immediate tick (async) to complete.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('fires an immediate extra tick on visibility restore', async () => {
    setVisibility('hidden');
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL * 100 }));

    // A very long interval — no tick expected from the timer.
    await advanceTimers(INTERVAL * 50);
    expect(onTick).not.toHaveBeenCalled();

    // Wake up.
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
      await Promise.resolve();
    });

    // The immediate tick fired without waiting for the full interval.
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('removes the visibilitychange listener on unmount', () => {
    const spy = vi.spyOn(document, 'removeEventListener');
    const onTick = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() =>
      useFeedPolling(onTick, { intervalMs: INTERVAL }),
    );

    unmount();

    expect(spy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });
});

// ---------------------------------------------------------------------------
// In-flight coalescing
// ---------------------------------------------------------------------------

describe('useFeedPolling — in-flight coalescing', () => {
  it('does not launch a second tick while one is still in flight', async () => {
    let resolveFirst!: () => void;
    const onTick = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    // First tick starts but hangs.
    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(1);

    // Second interval fires while first is still pending.
    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(1); // coalesced — still 1

    // Resolve the first; next interval should fire.
    await act(async () => {
      resolveFirst();
      await Promise.resolve();
    });

    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Cursor reset behaviour
// ---------------------------------------------------------------------------

describe('useFeedPolling — cursor (since) management', () => {
  it('advances the since cursor after a successful tick', async () => {
    const cursors: string[] = [];
    const onTick = vi.fn().mockImplementation(async (since: string) => {
      cursors.push(since);
    });

    // Fix the clock so we can reason about the cursor.
    const baseTime = new Date('2025-06-01T10:00:00.000Z').getTime();
    vi.setSystemTime(baseTime);

    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    // Advance one second so the first tick fires at baseTime + INTERVAL.
    await advanceTimers(INTERVAL);
    // Advance again.
    await advanceTimers(INTERVAL);

    expect(cursors).toHaveLength(2);
    // The second cursor must be at least as recent as the first.
    expect(new Date(cursors[1]).getTime()).toBeGreaterThanOrEqual(
      new Date(cursors[0]).getTime(),
    );
  });

  it('does not advance the since cursor on a failed tick', async () => {
    const cursors: string[] = [];
    let callCount = 0;
    const onTick = vi.fn().mockImplementation(async (since: string) => {
      cursors.push(since);
      callCount++;
      if (callCount === 1) throw new Error('network error');
    });

    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    // First tick throws.
    await advanceTimers(INTERVAL);
    expect(cursors).toHaveLength(1);

    // Second tick should retry with the SAME cursor (not advanced).
    await advanceTimers(INTERVAL);
    expect(cursors).toHaveLength(2);
    expect(cursors[0]).toBe(cursors[1]);
  });

  it('resets the cursor to "now" when re-enabled', async () => {
    const cursors: string[] = [];
    const onTick = vi.fn().mockImplementation(async (since: string) => {
      cursors.push(since);
    });

    const base = new Date('2025-06-01T10:00:00.000Z').getTime();
    vi.setSystemTime(base);

    let enabled = true;
    const { rerender } = renderHook(() =>
      useFeedPolling(onTick, { intervalMs: INTERVAL, enabled }),
    );

    // Fire one tick, record cursor.
    await advanceTimers(INTERVAL);
    const firstCursor = cursors[0];

    // Disable.
    enabled = false;
    rerender();

    // Advance time significantly while disabled.
    vi.setSystemTime(base + 60_000);

    // Re-enable — the cursor should reset to "now" (base + 60 000ms), not the old value.
    enabled = true;
    rerender();

    await advanceTimers(INTERVAL);
    const secondCursor = cursors[1];

    expect(new Date(secondCursor).getTime()).toBeGreaterThan(
      new Date(firstCursor).getTime(),
    );
  });
});

// ---------------------------------------------------------------------------
// Error resilience
// ---------------------------------------------------------------------------

describe('useFeedPolling — error handling', () => {
  it('swallows errors from onTick and continues polling', async () => {
    const onTick = vi
      .fn()
      .mockRejectedValueOnce(new Error('server 500'))
      .mockResolvedValue(undefined);

    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    // First tick throws — should not crash.
    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(1);

    // Second tick must still fire.
    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(2);
  });

  it('resets inFlight flag after an error so the next tick is not blocked', async () => {
    let resolveSecond!: () => void;
    const onTick = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    // First tick: errors, inFlight released.
    await advanceTimers(INTERVAL);

    // Second tick fires and hangs — confirms inFlight was released after error.
    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(2);

    // Clean up the hanging promise.
    await act(async () => {
      resolveSecond();
      await Promise.resolve();
    });
  });
});

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

describe('useFeedPolling — default options', () => {
  it('uses 3000ms as the default interval', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick));

    await advanceTimers(2999);
    expect(onTick).not.toHaveBeenCalled();

    await advanceTimers(1);
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('is enabled by default', async () => {
    const onTick = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useFeedPolling(onTick, { intervalMs: INTERVAL }));

    await advanceTimers(INTERVAL);
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});
