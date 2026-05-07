import { describe, it, expect } from "vitest";
import { toRelativeHu } from "@/components/social/RelativeTime.helpers";

const NOW_ISO = "2025-06-01T12:00:00.000Z";
const NOW_MS = new Date(NOW_ISO).getTime();

function isoFromOffset(offsetSec: number): string {
  return new Date(NOW_MS - offsetSec * 1000).toISOString();
}

describe("toRelativeHu", () => {
  it('returns "—" for an unparseable ISO string', () => {
    expect(toRelativeHu("not-a-date", NOW_MS)).toBe("—");
  });

  it('returns "most" for a 0-second delta', () => {
    expect(toRelativeHu(NOW_ISO, NOW_MS)).toBe("most");
  });

  it('returns "most" for a 30-second delta (below the 45s threshold)', () => {
    expect(toRelativeHu(isoFromOffset(30), NOW_MS)).toBe("most");
  });

  it('returns "most" for a future timestamp (negative delta clamped to 0)', () => {
    // diffSec is clamped to >= 0, so anything in the future still says "most".
    expect(toRelativeHu(isoFromOffset(-120), NOW_MS)).toBe("most");
  });

  it('returns "1 perce" at 45 seconds (lower edge of the minutes bucket)', () => {
    expect(toRelativeHu(isoFromOffset(45), NOW_MS)).toBe("1 perce");
  });

  it('returns "5 perce" at 5 minutes', () => {
    expect(toRelativeHu(isoFromOffset(5 * 60), NOW_MS)).toBe("5 perce");
  });

  it('returns "59 perce" just before the 1-hour boundary', () => {
    // 59m 30s rounds to 60, but Math.round(3570/60) = 60. Use 59m 0s = 59m.
    expect(toRelativeHu(isoFromOffset(59 * 60), NOW_MS)).toBe("59 perce");
  });

  it('returns "1 órája" at exactly 1 hour', () => {
    expect(toRelativeHu(isoFromOffset(60 * 60), NOW_MS)).toBe("1 órája");
  });

  it('returns "5 órája" at 5 hours', () => {
    expect(toRelativeHu(isoFromOffset(5 * 60 * 60), NOW_MS)).toBe("5 órája");
  });

  it('returns "1 napja" at exactly 24 hours', () => {
    expect(toRelativeHu(isoFromOffset(24 * 60 * 60), NOW_MS)).toBe("1 napja");
  });

  it('returns "2 napja" at 2 days', () => {
    expect(toRelativeHu(isoFromOffset(2 * 24 * 60 * 60), NOW_MS)).toBe(
      "2 napja",
    );
  });

  it("falls back to formatDateTime once the gap exceeds 7 days", () => {
    const result = toRelativeHu(isoFromOffset(8 * 24 * 60 * 60), NOW_MS);
    // The formatDateTime fallback never returns the "X napja" / "most" /
    // "perce" / "órája" phrasing — it returns a Hungarian short datetime.
    expect(result).not.toBe("most");
    expect(result).not.toMatch(/napja$/);
    expect(result).not.toMatch(/órája$/);
    expect(result).not.toMatch(/perce$/);
    // Sanity: it's a non-empty string, not "—".
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns a string type for valid input", () => {
    expect(typeof toRelativeHu(NOW_ISO, NOW_MS)).toBe("string");
  });
});
