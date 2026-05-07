import { describe, it, expect } from "vitest";
import { formatPointReason } from "@/lib/i18n/transaction-reasons";

describe("formatPointReason", () => {
  // --- Null / undefined / non-string inputs ---
  it("returns empty string for null", () => {
    expect(formatPointReason(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatPointReason(undefined)).toBe("");
  });

  // --- Empty / whitespace-only strings ---
  it("returns empty string for an empty string", () => {
    expect(formatPointReason("")).toBe("");
  });

  it("returns empty string for a whitespace-only string", () => {
    expect(formatPointReason("   ")).toBe("");
  });

  // --- Known keys: exact match ---
  it('maps "poll_win" → "Sikeres tipp"', () => {
    expect(formatPointReason("poll_win")).toBe("Sikeres tipp");
  });

  it('maps "poll_winner" → "Sikeres tipp"', () => {
    expect(formatPointReason("poll_winner")).toBe("Sikeres tipp");
  });

  it('maps "coupon_redeem" → "Kupon beváltás"', () => {
    expect(formatPointReason("coupon_redeem")).toBe("Kupon beváltás");
  });

  it('maps "registration_bonus" → "Regisztrációs bónusz"', () => {
    expect(formatPointReason("registration_bonus")).toBe(
      "Regisztrációs bónusz"
    );
  });

  it('maps "purchase" → "Vásárlás"', () => {
    expect(formatPointReason("purchase")).toBe("Vásárlás");
  });

  it('maps "admin_grant" → "Admin jóváírás"', () => {
    expect(formatPointReason("admin_grant")).toBe("Admin jóváírás");
  });

  // --- Case-insensitive matching ---
  it('maps "POLL_WIN" (all caps) → "Sikeres tipp" (case-insensitive)', () => {
    expect(formatPointReason("POLL_WIN")).toBe("Sikeres tipp");
  });

  it('maps "Poll_Win" (mixed case) → "Sikeres tipp"', () => {
    expect(formatPointReason("Poll_Win")).toBe("Sikeres tipp");
  });

  // --- Whitespace trimming before lookup ---
  it('maps "  poll_win  " (leading/trailing spaces) → "Sikeres tipp"', () => {
    expect(formatPointReason("  poll_win  ")).toBe("Sikeres tipp");
  });

  it('maps "  COUPON_REDEEM  " → "Kupon beváltás"', () => {
    expect(formatPointReason("  COUPON_REDEEM  ")).toBe("Kupon beváltás");
  });

  // --- Unknown keys: Title-cased fallback ---
  it('falls back to "Custom reward" for "custom_reward"', () => {
    expect(formatPointReason("custom_reward")).toBe("Custom reward");
  });

  it('falls back to "Some unknown reason" for "some_unknown_reason"', () => {
    expect(formatPointReason("some_unknown_reason")).toBe(
      "Some unknown reason"
    );
  });

  it('falls back to "Singleword" for "singleword" (no underscore)', () => {
    expect(formatPointReason("singleword")).toBe("Singleword");
  });

  it('falls back to "Unknown key" for "UNKNOWN_KEY" (uppercase unknown, lowercased then title-cased)', () => {
    expect(formatPointReason("UNKNOWN_KEY")).toBe("Unknown key");
  });

  // --- Multiple consecutive underscores (collapse to single space) ---
  it('collapses multiple underscores to a single space in fallback', () => {
    expect(formatPointReason("double__underscore")).toBe("Double underscore");
  });

  // --- Return type ---
  it("always returns a string for a known key", () => {
    expect(typeof formatPointReason("purchase")).toBe("string");
  });

  it("always returns a string for an unknown key", () => {
    expect(typeof formatPointReason("mystery_key")).toBe("string");
  });
});
