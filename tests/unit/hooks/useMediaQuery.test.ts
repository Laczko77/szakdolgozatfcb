// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

// ---------------------------------------------------------------------------
// matchMedia mock factory
// ---------------------------------------------------------------------------

type ChangeHandler = (e: MediaQueryListEvent) => void;

function createMqlStub(query: string, initialMatches: boolean) {
  const listeners: ChangeHandler[] = [];
  const stub = {
    matches: initialMatches,
    media: query,
    addEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      listeners.push(handler);
    }),
    removeEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    _fire(newMatches: boolean) {
      stub.matches = newMatches;
      const event = { matches: newMatches, media: query } as MediaQueryListEvent;
      listeners.forEach((fn) => fn(event));
    },
    _listenerCount() {
      return listeners.length;
    },
  };
  return stub;
}

// jsdom does not implement window.matchMedia — install a no-op placeholder
// so that vi.spyOn has something to wrap. Each test then overrides it.
beforeEach(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMediaQuery', () => {
  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  it('returns false on the very first render (SSR-safe default)', async () => {
    // The hook starts with useState(false) and only updates via a deferred
    // queueMicrotask. The initial value visible to the caller is always false,
    // matching SSR output so there is no hydration mismatch.
    // We confirm this by rendering, reading before the microtask drains,
    // then flushing so React doesn't warn about an out-of-act state update.
    const mql = createMqlStub('(max-width: 768px)', true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    // useState initial value — queueMicrotask has not yet fired.
    expect(result.current).toBe(false);

    // Drain the pending microtask so React processes the deferred setState
    // without emitting "not wrapped in act" warnings.
    await act(async () => { await Promise.resolve(); });
  });

  it('reflects the real matchMedia result after microtask flushes', async () => {
    const mql = createMqlStub('(max-width: 768px)', true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

    // Flush pending microtasks so queueMicrotask callback runs.
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  it('returns false after microtask flush when query does not match', async () => {
    const mql = createMqlStub('(min-width: 1200px)', false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery('(min-width: 1200px)'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Reactive change events
  // -------------------------------------------------------------------------

  it('updates to true when the media query fires a match event', async () => {
    const mql = createMqlStub('(max-width: 768px)', false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(false);

    act(() => {
      mql._fire(true);
    });

    expect(result.current).toBe(true);
  });

  it('updates to false when the media query fires a no-match event', async () => {
    const mql = createMqlStub('(max-width: 768px)', true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(true);

    act(() => {
      mql._fire(false);
    });

    expect(result.current).toBe(false);
  });

  it('toggles through multiple change events correctly', async () => {
    const mql = createMqlStub('(max-width: 768px)', false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

    // Drain the queueMicrotask from the initial effect before firing events.
    await act(async () => { await Promise.resolve(); });

    act(() => { mql._fire(true); });
    expect(result.current).toBe(true);

    act(() => { mql._fire(false); });
    expect(result.current).toBe(false);

    act(() => { mql._fire(true); });
    expect(result.current).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Query string is forwarded correctly
  // -------------------------------------------------------------------------

  it('passes the exact query string to window.matchMedia', async () => {
    const query = '(prefers-color-scheme: dark)';
    const mql = createMqlStub(query, false);
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    renderHook(() => useMediaQuery(query));

    expect(spy).toHaveBeenCalledWith(query);
  });

  it('works with a "(min-width: 1024px)" query string', async () => {
    const query = '(min-width: 1024px)';
    const mql = createMqlStub(query, true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery(query));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  it('works with a "(prefers-color-scheme: dark)" query string', async () => {
    const query = '(prefers-color-scheme: dark)';
    const mql = createMqlStub(query, true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useMediaQuery(query));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  it('removes the event listener on unmount', () => {
    const mql = createMqlStub('(max-width: 768px)', false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(mql._listenerCount()).toBe(1);

    unmount();

    expect(mql._listenerCount()).toBe(0);
    expect(mql.removeEventListener).toHaveBeenCalledOnce();
  });

  it('does not throw or update state when a change event fires after unmount', () => {
    const mql = createMqlStub('(max-width: 768px)', false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result, unmount } = renderHook(() =>
      useMediaQuery('(max-width: 768px)'),
    );
    unmount();

    expect(() => {
      act(() => { mql._fire(true); });
    }).not.toThrow();
    expect(result.current).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Re-mount creates a fresh subscription
  // -------------------------------------------------------------------------

  it('re-subscribes when the hook remounts', async () => {
    const mql = createMqlStub('(max-width: 768px)', true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    unmount();

    // After unmount there should be 0 listeners.
    expect(mql._listenerCount()).toBe(0);

    // Remount.
    const { result: result2 } = renderHook(() =>
      useMediaQuery('(max-width: 768px)'),
    );
    expect(mql._listenerCount()).toBe(1);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result2.current).toBe(true);
  });
});
