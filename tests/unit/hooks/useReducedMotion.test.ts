// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ---------------------------------------------------------------------------
// matchMedia mock factory
// ---------------------------------------------------------------------------
// jsdom does not implement window.matchMedia, so we provide a minimal stub.
// Each call to createMqlStub returns a fresh object with controllable state.

type ChangeHandler = (e: MediaQueryListEvent) => void;

function createMqlStub(initialMatches: boolean) {
  const listeners: ChangeHandler[] = [];
  const stub = {
    matches: initialMatches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      listeners.push(handler);
    }),
    removeEventListener: vi.fn((_type: string, handler: ChangeHandler) => {
      const idx = listeners.indexOf(handler);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    // Helper: fire a change event to all listeners.
    _fire(newMatches: boolean) {
      stub.matches = newMatches;
      const event = { matches: newMatches } as MediaQueryListEvent;
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

describe('useReducedMotion', () => {
  it('returns false initially (SSR-safe default before effect runs)', () => {
    // Provide a stub where the media query does NOT match.
    const mql = createMqlStub(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useReducedMotion());
    // After mount the effect runs synchronously in renderHook, so
    // the hook calls mq.matches (false) and sets state accordingly.
    expect(result.current).toBe(false);
  });

  it('returns true immediately after mount when the OS preference is set', () => {
    const mql = createMqlStub(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates to true when a "change" event fires with matches=true', () => {
    const mql = createMqlStub(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      mql._fire(true);
    });

    expect(result.current).toBe(true);
  });

  it('updates to false when a "change" event fires with matches=false', () => {
    const mql = createMqlStub(true);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => {
      mql._fire(false);
    });

    expect(result.current).toBe(false);
  });

  it('toggles correctly through multiple change events', () => {
    const mql = createMqlStub(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result } = renderHook(() => useReducedMotion());

    act(() => { mql._fire(true); });
    expect(result.current).toBe(true);

    act(() => { mql._fire(false); });
    expect(result.current).toBe(false);

    act(() => { mql._fire(true); });
    expect(result.current).toBe(true);
  });

  it('queries the correct media string "(prefers-reduced-motion: reduce)"', () => {
    const mql = createMqlStub(false);
    const spy = vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    renderHook(() => useReducedMotion());

    expect(spy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('removes the event listener on unmount', () => {
    const mql = createMqlStub(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { unmount } = renderHook(() => useReducedMotion());
    expect(mql._listenerCount()).toBe(1);

    unmount();

    expect(mql._listenerCount()).toBe(0);
    expect(mql.removeEventListener).toHaveBeenCalledOnce();
  });

  it('does not respond to change events after unmount', () => {
    const mql = createMqlStub(false);
    vi.spyOn(window, 'matchMedia').mockReturnValue(
      mql as unknown as MediaQueryList,
    );

    const { result, unmount } = renderHook(() => useReducedMotion());
    unmount();

    // Firing after unmount must not throw and must not update state.
    expect(() => {
      act(() => { mql._fire(true); });
    }).not.toThrow();
    // The result captured before unmount remains stale at false —
    // we just verify no error is thrown and the listener was removed.
    expect(result.current).toBe(false);
  });
});
