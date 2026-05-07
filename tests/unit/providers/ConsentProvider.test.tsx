// @vitest-environment jsdom
/**
 * ConsentProvider unit tests.
 *
 * analytics-api.postConsent is mocked so no HTTP calls are made.
 * localStorage is replaced with a working in-memory mock because jsdom's
 * built-in localStorage may be non-functional (--localstorage-file warning).
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// ---------------------------------------------------------------------------
// localStorage in-memory mock (replaces jsdom's broken implementation)
// ---------------------------------------------------------------------------
function createLocalStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
}

const localStorageMock = createLocalStorageMock();
vi.stubGlobal('localStorage', localStorageMock);

// ---------------------------------------------------------------------------
// Mock @/lib/analytics-api
// ---------------------------------------------------------------------------
vi.mock('@/lib/analytics-api', () => ({
  postConsent: vi.fn(),
  postPageView: vi.fn(),
  fetchRecommendedProducts: vi.fn(),
}));

import { postConsent } from '@/lib/analytics-api';
import { ConsentProvider, useConsent } from '@/providers/ConsentProvider';
import {
  CONSENT_STATUS_KEY,
  CONSENT_COOKIE_KEY,
  setStoredConsent,
} from '@/lib/consent';

const mockPostConsent = postConsent as Mock;

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

function ConsentFixture() {
  const { hydrated, record, isSubmitting, accept, decline } = useConsent();
  return (
    <div>
      <span data-testid="hydrated">{hydrated ? 'yes' : 'no'}</span>
      <span data-testid="status">{record?.status ?? 'none'}</span>
      <span data-testid="cookie">{record?.cookieId ?? 'null'}</span>
      <span data-testid="submitting">{isSubmitting ? 'yes' : 'no'}</span>
      <button data-testid="btn-accept" onClick={accept}>accept</button>
      <button data-testid="btn-decline" onClick={decline}>decline</button>
    </div>
  );
}

function renderConsent() {
  return render(
    <ConsentProvider>
      <ConsentFixture />
    </ConsentProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  mockPostConsent.mockResolvedValue({ cookie_id: 'test-cookie-uuid', consented: true, created_at: '' });
});

afterEach(() => {
  localStorageMock.clear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConsentProvider', () => {
  describe('useConsent outside provider', () => {
    it('throws when used outside ConsentProvider', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<ConsentFixture />)).toThrow(
        'useConsent must be used inside <ConsentProvider />',
      );
      spy.mockRestore();
    });
  });

  describe('hydration', () => {
    it('hydrates asynchronously (hydrated becomes true)', async () => {
      renderConsent();
      await waitFor(() => {
        expect(screen.getByTestId('hydrated').textContent).toBe('yes');
      });
    });

    it('reads an existing "accepted" decision from localStorage on mount', async () => {
      localStorageMock.setItem(CONSENT_STATUS_KEY, 'accepted');
      localStorageMock.setItem(CONSENT_COOKIE_KEY, 'existing-cookie');
      renderConsent();
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('accepted');
        expect(screen.getByTestId('cookie').textContent).toBe('existing-cookie');
      });
    });

    it('reads an existing "declined" decision from localStorage on mount', async () => {
      localStorageMock.setItem(CONSENT_STATUS_KEY, 'declined');
      renderConsent();
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('declined');
        // cookieId is null for declined
        expect(screen.getByTestId('cookie').textContent).toBe('null');
      });
    });

    it('has record=null when no decision is stored', async () => {
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));
      expect(screen.getByTestId('status').textContent).toBe('none');
    });
  });

  describe('accept()', () => {
    it('calls postConsent with consented=true', async () => {
      const user = userEvent.setup();
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      await user.click(screen.getByTestId('btn-accept'));

      expect(mockPostConsent).toHaveBeenCalledWith(true, undefined);
    });

    it('stores the cookie_id returned by the server after accept', async () => {
      const user = userEvent.setup();
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      await user.click(screen.getByTestId('btn-accept'));

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('accepted');
        expect(screen.getByTestId('cookie').textContent).toBe('test-cookie-uuid');
      });
    });

    it('sets isSubmitting=true during the in-flight request', async () => {
      const user = userEvent.setup();
      let resolvePost!: (v: { cookie_id: string; consented: boolean; created_at: string }) => void;
      mockPostConsent.mockReturnValue(
        new Promise((res) => { resolvePost = res; }),
      );
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      const clickPromise = user.click(screen.getByTestId('btn-accept'));
      await waitFor(() => {
        expect(screen.getByTestId('submitting').textContent).toBe('yes');
      });

      await act(async () => {
        resolvePost({ cookie_id: 'x', consented: true, created_at: '' });
      });
      await clickPromise;
      expect(screen.getByTestId('submitting').textContent).toBe('no');
    });

    it('reuses the existing cookieId when re-accepting', async () => {
      const user = userEvent.setup();
      localStorageMock.setItem(CONSENT_STATUS_KEY, 'accepted');
      localStorageMock.setItem(CONSENT_COOKIE_KEY, 'pre-existing-id');
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('cookie').textContent).toBe('pre-existing-id'));

      await user.click(screen.getByTestId('btn-accept'));

      expect(mockPostConsent).toHaveBeenCalledWith(true, 'pre-existing-id');
    });
  });

  describe('decline()', () => {
    it('calls postConsent with consented=false', async () => {
      const user = userEvent.setup();
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      await user.click(screen.getByTestId('btn-decline'));

      expect(mockPostConsent).toHaveBeenCalledWith(false, undefined);
    });

    it('stores declined status with null cookieId', async () => {
      const user = userEvent.setup();
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      await user.click(screen.getByTestId('btn-decline'));

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('declined');
        expect(screen.getByTestId('cookie').textContent).toBe('null');
      });
    });
  });

  describe('backend fallback — saves locally even when postConsent fails', () => {
    it('saves "accepted" status locally when the backend call throws', async () => {
      const user = userEvent.setup();
      mockPostConsent.mockRejectedValue(new Error('Network Error'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      await user.click(screen.getByTestId('btn-accept'));

      // Even with backend failure the local decision should be persisted
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('accepted');
      });
      // cookieId is null because backend didn't return one
      expect(screen.getByTestId('cookie').textContent).toBe('null');
      warnSpy.mockRestore();
    });

    it('saves "declined" status locally when the backend call throws', async () => {
      const user = userEvent.setup();
      mockPostConsent.mockRejectedValue(new Error('Network Error'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      await user.click(screen.getByTestId('btn-decline'));

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('declined');
      });
      warnSpy.mockRestore();
    });
  });

  describe('cross-tab storage event sync', () => {
    it('updates the record when another tab writes to localStorage', async () => {
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));
      expect(screen.getByTestId('status').textContent).toBe('none');

      // Simulate another tab writing the consent then firing the storage event
      act(() => {
        localStorageMock.setItem(CONSENT_STATUS_KEY, 'accepted');
        localStorageMock.setItem(CONSENT_COOKIE_KEY, 'cross-tab-cookie');
        // Fire the native storage event (simulates cross-tab)
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: CONSENT_STATUS_KEY,
            newValue: 'accepted',
          }),
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('accepted');
      });
    });

    it('updates the record when a same-tab custom event fires', async () => {
      renderConsent();
      await waitFor(() => expect(screen.getByTestId('hydrated').textContent).toBe('yes'));

      act(() => {
        // setStoredConsent writes to our localStorage mock AND dispatches CONSENT_CHANGED_EVENT
        setStoredConsent('declined', null);
      });

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('declined');
      });
    });
  });
});
