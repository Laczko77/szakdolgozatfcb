import { describe, it, expect } from "vitest";
import { formatPrice, formatDate, formatDateTime } from "@/lib/format";

// The hu-HU locale uses a NON-BREAKING SPACE (U+00A0, char code 160) as the
// thousands separator. Build the expected strings programmatically so the test
// file stays readable and locale-correct without hard-coding invisible chars.
const NBSP = " ";

describe("formatPrice", () => {
  it("formats a whole number with Hungarian locale and trailing Ft", () => {
    expect(formatPrice(99)).toBe(`99 Ft`);
  });

  it("formats a large number using non-breaking spaces as thousands separators", () => {
    expect(formatPrice(1234567)).toBe(`1${NBSP}234${NBSP}567 Ft`);
  });

  it("returns '0 Ft' for 0", () => {
    expect(formatPrice(0)).toBe("0 Ft");
  });

  it("rounds 1.7 up to 2", () => {
    expect(formatPrice(1.7)).toBe("2 Ft");
  });

  it("rounds 1.4 down to 1", () => {
    expect(formatPrice(1.4)).toBe("1 Ft");
  });

  it("rounds 4990.5 up to 4991", () => {
    // 4-digit numbers have no thousands separator in hu-HU locale.
    expect(formatPrice(4990.5)).toBe("4991 Ft");
  });

  it("formats negative numbers", () => {
    expect(formatPrice(-500)).toBe("-500 Ft");
  });

  it("returns '0 Ft' for NaN", () => {
    expect(formatPrice(NaN)).toBe("0 Ft");
  });

  it("returns '0 Ft' for positive Infinity", () => {
    expect(formatPrice(Infinity)).toBe("0 Ft");
  });

  it("returns '0 Ft' for negative Infinity", () => {
    expect(formatPrice(-Infinity)).toBe("0 Ft");
  });

  it("formats a large round number", () => {
    expect(formatPrice(10000)).toBe(`10${NBSP}000 Ft`);
  });

  it("returns a string type", () => {
    expect(typeof formatPrice(100)).toBe("string");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date string in Hungarian long format", () => {
    // Use a local-time ISO string (no Z) to avoid timezone-shift in the output.
    const result = formatDate("2024-03-15");
    expect(result).toBe("2024. március 15.");
  });

  it("formats 1 January correctly", () => {
    const result = formatDate("2024-01-01");
    expect(result).toBe("2024. január 1.");
  });

  it("returns '—' for an invalid date string", () => {
    expect(formatDate("nem-dátum")).toBe("—");
  });

  it("returns '—' for an empty string", () => {
    expect(formatDate("")).toBe("—");
  });

  it("returns '—' for a garbage string", () => {
    expect(formatDate("hello world")).toBe("—");
  });

  it("returns a string type for valid input", () => {
    expect(typeof formatDate("2024-06-01")).toBe("string");
  });

  it("returns a string type for invalid input", () => {
    expect(typeof formatDate("invalid")).toBe("string");
  });
});

describe("formatDateTime", () => {
  it("formats a valid local ISO datetime string in Hungarian short format", () => {
    // No trailing Z so the local clock is used — output is deterministic.
    const result = formatDateTime("2024-03-15T10:30:00");
    expect(result).toBe("2024. márc. 15. 10:30");
  });

  it("formats midnight correctly", () => {
    const result = formatDateTime("2024-01-01T00:00:00");
    expect(result).toBe("2024. jan. 1. 00:00");
  });

  it("returns '—' for an invalid datetime string", () => {
    expect(formatDateTime("nem-dátum")).toBe("—");
  });

  it("returns '—' for an empty string", () => {
    expect(formatDateTime("")).toBe("—");
  });

  it("returns '—' for a plain non-date string", () => {
    expect(formatDateTime("just text")).toBe("—");
  });

  it("returns a string type for valid input", () => {
    expect(typeof formatDateTime("2024-06-01T12:00:00")).toBe("string");
  });
});
