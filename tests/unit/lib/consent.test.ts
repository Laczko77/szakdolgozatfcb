import { vi, beforeEach, afterEach, describe, it, expect } from "vitest";
import {
  getStoredConsent,
  setStoredConsent,
  clearStoredConsent,
  CONSENT_STATUS_KEY,
  CONSENT_COOKIE_KEY,
  CONSENT_DECIDED_KEY,
  CONSENT_CHANGED_EVENT,
} from "@/lib/consent";

// ---------------------------------------------------------------------------
// In-memory localStorage mock
// ---------------------------------------------------------------------------

function createLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => {
      store[key] = value;
    },
    removeItem: (key: string): void => {
      delete store[key];
    },
    clear: (): void => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
}

// ---------------------------------------------------------------------------
// Window mock setup / teardown
// ---------------------------------------------------------------------------

let localStorageMock: ReturnType<typeof createLocalStorageMock>;
const dispatchEventMock = vi.fn();

beforeEach(() => {
  localStorageMock = createLocalStorageMock();
  dispatchEventMock.mockReset();
  (globalThis as Record<string, unknown>).window = {
    localStorage: localStorageMock,
    dispatchEvent: dispatchEventMock,
    CustomEvent: class {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    },
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

// ---------------------------------------------------------------------------
// Exported constants
// ---------------------------------------------------------------------------

describe("exported constants", () => {
  it("CONSENT_STATUS_KEY is fcb_consent_status", () => {
    expect(CONSENT_STATUS_KEY).toBe("fcb_consent_status");
  });

  it("CONSENT_COOKIE_KEY is fcb_consent_cookie", () => {
    expect(CONSENT_COOKIE_KEY).toBe("fcb_consent_cookie");
  });

  it("CONSENT_DECIDED_KEY is fcb_consent_decided_at", () => {
    expect(CONSENT_DECIDED_KEY).toBe("fcb_consent_decided_at");
  });

  it("CONSENT_CHANGED_EVENT is fcb-consent-changed", () => {
    expect(CONSENT_CHANGED_EVENT).toBe("fcb-consent-changed");
  });
});

// ---------------------------------------------------------------------------
// SSR guard (window = undefined)
// ---------------------------------------------------------------------------

describe("SSR guard — window undefined", () => {
  it("getStoredConsent returns null when window is undefined", () => {
    delete (globalThis as Record<string, unknown>).window;
    expect(getStoredConsent()).toBeNull();
  });

  it("setStoredConsent does not throw when window is undefined", () => {
    delete (globalThis as Record<string, unknown>).window;
    expect(() => setStoredConsent("accepted", "uuid-ssr")).not.toThrow();
  });

  it("setStoredConsent returns undefined (void) when window is undefined", () => {
    delete (globalThis as Record<string, unknown>).window;
    expect(setStoredConsent("declined", null)).toBeUndefined();
  });

  it("clearStoredConsent does not throw when window is undefined", () => {
    delete (globalThis as Record<string, unknown>).window;
    expect(() => clearStoredConsent()).not.toThrow();
  });

  it("clearStoredConsent returns undefined (void) when window is undefined", () => {
    delete (globalThis as Record<string, unknown>).window;
    expect(clearStoredConsent()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getStoredConsent — browser environment
// ---------------------------------------------------------------------------

describe("getStoredConsent — browser environment", () => {
  it("returns null when localStorage is empty", () => {
    expect(getStoredConsent()).toBeNull();
  });

  it("returns null when status value is invalid", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "invalid");
    expect(getStoredConsent()).toBeNull();
  });

  it("returns null when status value is an arbitrary string", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "yes");
    expect(getStoredConsent()).toBeNull();
  });

  it("returns accepted record with null cookieId when accepted but no cookie stored", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "accepted");
    const record = getStoredConsent();
    expect(record).not.toBeNull();
    expect(record!.status).toBe("accepted");
    expect(record!.cookieId).toBeNull();
    expect(typeof record!.decidedAt).toBe("string");
  });

  it("returns accepted record with cookieId when accepted and cookie is stored", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "accepted");
    localStorageMock.setItem(CONSENT_COOKIE_KEY, "uuid-123");
    const record = getStoredConsent();
    expect(record).not.toBeNull();
    expect(record!.status).toBe("accepted");
    expect(record!.cookieId).toBe("uuid-123");
  });

  it("returns declined record with cookieId = null even when cookie is stored", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "declined");
    localStorageMock.setItem(CONSENT_COOKIE_KEY, "should-not-appear");
    const record = getStoredConsent();
    expect(record).not.toBeNull();
    expect(record!.status).toBe("declined");
    expect(record!.cookieId).toBeNull();
  });

  it("returns declined record with null cookieId when no cookie is stored", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "declined");
    const record = getStoredConsent();
    expect(record).not.toBeNull();
    expect(record!.status).toBe("declined");
    expect(record!.cookieId).toBeNull();
  });

  it("returns stored decidedAt when present", () => {
    const timestamp = "2024-06-15T12:00:00.000Z";
    localStorageMock.setItem(CONSENT_STATUS_KEY, "accepted");
    localStorageMock.setItem(CONSENT_DECIDED_KEY, timestamp);
    const record = getStoredConsent();
    expect(record!.decidedAt).toBe(timestamp);
  });

  it("returns a current ISO timestamp for decidedAt when not stored", () => {
    const before = new Date().toISOString();
    localStorageMock.setItem(CONSENT_STATUS_KEY, "accepted");
    const record = getStoredConsent();
    const after = new Date().toISOString();
    expect(record!.decidedAt >= before).toBe(true);
    expect(record!.decidedAt <= after).toBe(true);
  });

  it("decidedAt is a valid ISO string (parseable by Date)", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "declined");
    const record = getStoredConsent();
    expect(Number.isNaN(Date.parse(record!.decidedAt))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setStoredConsent — browser environment
// ---------------------------------------------------------------------------

describe("setStoredConsent — browser environment", () => {
  it("writes status to localStorage on accepted", () => {
    setStoredConsent("accepted", "uuid-abc");
    expect(localStorageMock.getItem(CONSENT_STATUS_KEY)).toBe("accepted");
  });

  it("writes cookieId to localStorage when accepted with a non-null id", () => {
    setStoredConsent("accepted", "uuid-abc");
    expect(localStorageMock.getItem(CONSENT_COOKIE_KEY)).toBe("uuid-abc");
  });

  it("writes status to localStorage on declined", () => {
    setStoredConsent("declined", null);
    expect(localStorageMock.getItem(CONSENT_STATUS_KEY)).toBe("declined");
  });

  it("removes cookie from localStorage on declined", () => {
    localStorageMock.setItem(CONSENT_COOKIE_KEY, "pre-existing-uuid");
    setStoredConsent("declined", null);
    expect(localStorageMock.getItem(CONSENT_COOKIE_KEY)).toBeNull();
  });

  it("removes cookie from localStorage on declined even when cookieId arg is provided", () => {
    localStorageMock.setItem(CONSENT_COOKIE_KEY, "pre-existing-uuid");
    setStoredConsent("declined", "uuid-should-be-ignored");
    expect(localStorageMock.getItem(CONSENT_COOKIE_KEY)).toBeNull();
  });

  it("does not write cookie to localStorage when accepted with null cookieId", () => {
    setStoredConsent("accepted", null);
    expect(localStorageMock.getItem(CONSENT_COOKIE_KEY)).toBeNull();
  });

  it("writes a decidedAt ISO timestamp to localStorage on accepted", () => {
    const before = new Date().toISOString();
    setStoredConsent("accepted", "uuid-abc");
    const after = new Date().toISOString();
    const stored = localStorageMock.getItem(CONSENT_DECIDED_KEY);
    expect(stored).not.toBeNull();
    expect(stored! >= before).toBe(true);
    expect(stored! <= after).toBe(true);
  });

  it("writes a decidedAt ISO timestamp to localStorage on declined", () => {
    const before = new Date().toISOString();
    setStoredConsent("declined", null);
    const after = new Date().toISOString();
    const stored = localStorageMock.getItem(CONSENT_DECIDED_KEY);
    expect(stored).not.toBeNull();
    expect(stored! >= before).toBe(true);
    expect(stored! <= after).toBe(true);
  });

  it("dispatches the consent-changed event on accepted", () => {
    setStoredConsent("accepted", "uuid-abc");
    expect(dispatchEventMock).toHaveBeenCalledOnce();
    const arg: { type: string } = dispatchEventMock.mock.calls[0][0];
    expect(arg.type).toBe(CONSENT_CHANGED_EVENT);
  });

  it("dispatches the consent-changed event on declined", () => {
    setStoredConsent("declined", null);
    expect(dispatchEventMock).toHaveBeenCalledOnce();
    const arg: { type: string } = dispatchEventMock.mock.calls[0][0];
    expect(arg.type).toBe(CONSENT_CHANGED_EVENT);
  });

  it("dispatches exactly once per call", () => {
    setStoredConsent("accepted", "uuid-abc");
    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// clearStoredConsent — browser environment
// ---------------------------------------------------------------------------

describe("clearStoredConsent — browser environment", () => {
  it("removes the status key from localStorage", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "accepted");
    clearStoredConsent();
    expect(localStorageMock.getItem(CONSENT_STATUS_KEY)).toBeNull();
  });

  it("removes the cookie key from localStorage", () => {
    localStorageMock.setItem(CONSENT_COOKIE_KEY, "uuid-xyz");
    clearStoredConsent();
    expect(localStorageMock.getItem(CONSENT_COOKIE_KEY)).toBeNull();
  });

  it("removes the decidedAt key from localStorage", () => {
    localStorageMock.setItem(CONSENT_DECIDED_KEY, "2024-01-01T00:00:00.000Z");
    clearStoredConsent();
    expect(localStorageMock.getItem(CONSENT_DECIDED_KEY)).toBeNull();
  });

  it("removes all three keys when all are set", () => {
    localStorageMock.setItem(CONSENT_STATUS_KEY, "accepted");
    localStorageMock.setItem(CONSENT_COOKIE_KEY, "uuid-xyz");
    localStorageMock.setItem(CONSENT_DECIDED_KEY, "2024-01-01T00:00:00.000Z");
    clearStoredConsent();
    expect(localStorageMock.getItem(CONSENT_STATUS_KEY)).toBeNull();
    expect(localStorageMock.getItem(CONSENT_COOKIE_KEY)).toBeNull();
    expect(localStorageMock.getItem(CONSENT_DECIDED_KEY)).toBeNull();
  });

  it("dispatches the consent-changed event", () => {
    clearStoredConsent();
    expect(dispatchEventMock).toHaveBeenCalledOnce();
    const arg: { type: string } = dispatchEventMock.mock.calls[0][0];
    expect(arg.type).toBe(CONSENT_CHANGED_EVENT);
  });

  it("dispatches exactly once per call", () => {
    clearStoredConsent();
    expect(dispatchEventMock).toHaveBeenCalledTimes(1);
  });

  it("does not throw when localStorage is already empty", () => {
    expect(() => clearStoredConsent()).not.toThrow();
  });
});
