import { describe, it, expect } from "vitest";
import {
  FIXED_SECTORS,
  FIXED_SECTOR_NAMES,
  isFixedSectorName,
} from "@/lib/constants/sectors";

describe("FIXED_SECTOR_NAMES", () => {
  it("contains exactly 4 sector names", () => {
    expect(FIXED_SECTOR_NAMES).toHaveLength(4);
  });

  it("contains all four expected sector names", () => {
    expect(FIXED_SECTOR_NAMES).toEqual(
      expect.arrayContaining(["TRIBUNA", "LATERAL", "GOL NORD", "GOL SUD"])
    );
  });
});

describe("FIXED_SECTORS", () => {
  it("has exactly 4 entries", () => {
    expect(FIXED_SECTORS).toHaveLength(4);
  });

  it("each entry has name, defaultSeats, and defaultPrice fields", () => {
    for (const sector of FIXED_SECTORS) {
      expect(typeof sector.name).toBe("string");
      expect(typeof sector.defaultSeats).toBe("number");
      expect(typeof sector.defaultPrice).toBe("number");
    }
  });
});

describe("isFixedSectorName", () => {
  // --- All four valid sector names ---
  it('returns true for "TRIBUNA"', () => {
    expect(isFixedSectorName("TRIBUNA")).toBe(true);
  });

  it('returns true for "LATERAL"', () => {
    expect(isFixedSectorName("LATERAL")).toBe(true);
  });

  it('returns true for "GOL NORD"', () => {
    expect(isFixedSectorName("GOL NORD")).toBe(true);
  });

  it('returns true for "GOL SUD"', () => {
    expect(isFixedSectorName("GOL SUD")).toBe(true);
  });

  // --- Loop-based exhaustive check on FIXED_SECTORS ---
  it("returns true for every name present in FIXED_SECTORS", () => {
    for (const sector of FIXED_SECTORS) {
      expect(isFixedSectorName(sector.name)).toBe(true);
    }
  });

  // --- Case sensitivity: names must be exact uppercase ---
  it('returns false for lowercase "tribuna"', () => {
    expect(isFixedSectorName("tribuna")).toBe(false);
  });

  it('returns false for mixed-case "Lateral"', () => {
    expect(isFixedSectorName("Lateral")).toBe(false);
  });

  it('returns false for lowercase "gol nord"', () => {
    expect(isFixedSectorName("gol nord")).toBe(false);
  });

  // --- Partial strings ---
  it('returns false for partial match "NORD"', () => {
    expect(isFixedSectorName("NORD")).toBe(false);
  });

  it('returns false for partial match "GOL"', () => {
    expect(isFixedSectorName("GOL")).toBe(false);
  });

  it('returns false for partial match "TRIBUN"', () => {
    expect(isFixedSectorName("TRIBUN")).toBe(false);
  });

  // --- Empty string ---
  it("returns false for an empty string", () => {
    expect(isFixedSectorName("")).toBe(false);
  });

  // --- Non-string primitives ---
  it("returns false for null", () => {
    expect(isFixedSectorName(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFixedSectorName(undefined)).toBe(false);
  });

  it("returns false for a number (123)", () => {
    expect(isFixedSectorName(123)).toBe(false);
  });

  it("returns false for a plain object", () => {
    expect(isFixedSectorName({})).toBe(false);
  });

  it("returns false for an array", () => {
    expect(isFixedSectorName(["TRIBUNA"])).toBe(false);
  });

  it("returns false for a boolean", () => {
    expect(isFixedSectorName(true)).toBe(false);
  });

  // --- Completely unrelated string ---
  it('returns false for "VIP" (unrelated valid-looking string)', () => {
    expect(isFixedSectorName("VIP")).toBe(false);
  });
});
