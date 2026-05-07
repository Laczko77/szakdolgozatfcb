import { describe, it, expect } from "vitest";
import { currentSeasonStartYear } from "@/lib/football-data";

// Helper: build a UTC date without relying on local timezone offsets.
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

describe("currentSeasonStartYear", () => {
  // --- Boundary: August 1 is the first day of the new season ---
  it("returns the current year on August 1 (UTC month index 7 — season starts)", () => {
    expect(currentSeasonStartYear(utcDate(2025, 8, 1))).toBe(2025);
  });

  // --- After the boundary ---
  it("returns the current year on December 31 (deep into the season)", () => {
    expect(currentSeasonStartYear(utcDate(2025, 12, 31))).toBe(2025);
  });

  it("returns the current year on September 15", () => {
    expect(currentSeasonStartYear(utcDate(2025, 9, 15))).toBe(2025);
  });

  // --- Before the boundary: July 31 is the last pre-season day ---
  it("returns previous year on July 31 (UTC month index 6 — still previous season)", () => {
    expect(currentSeasonStartYear(utcDate(2025, 7, 31))).toBe(2024);
  });

  it("returns previous year on January 1 (early in calendar year, previous season)", () => {
    expect(currentSeasonStartYear(utcDate(2025, 1, 1))).toBe(2024);
  });

  it("returns previous year on March 10", () => {
    expect(currentSeasonStartYear(utcDate(2026, 3, 10))).toBe(2025);
  });

  // --- Leap year edge case ---
  it("returns previous year on February 29 of a leap year (2024)", () => {
    expect(currentSeasonStartYear(utcDate(2024, 2, 29))).toBe(2023);
  });

  // --- Concrete season boundary dates ---
  it("2025-08-01 → 2025 (season 2025/26 starts)", () => {
    expect(currentSeasonStartYear(utcDate(2025, 8, 1))).toBe(2025);
  });

  it("2025-07-31 → 2024 (still in 2024/25 season)", () => {
    expect(currentSeasonStartYear(utcDate(2025, 7, 31))).toBe(2024);
  });

  it("2024-01-15 → 2023 (mid-season, 2023/24 season)", () => {
    expect(currentSeasonStartYear(utcDate(2024, 1, 15))).toBe(2023);
  });

  // --- Return type ---
  it("always returns a number", () => {
    expect(typeof currentSeasonStartYear(utcDate(2025, 6, 1))).toBe("number");
  });

  // --- Default argument (smoke test — just verify it returns a number) ---
  it("returns a number when called with no argument (uses current date)", () => {
    expect(typeof currentSeasonStartYear()).toBe("number");
  });
});
