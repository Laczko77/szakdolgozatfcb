import { describe, it, expect } from "vitest";
import {
  buildSlotMap,
  describeSector,
} from "@/components/tickets/StadiumMap.helpers";
import type { SectorWithAvailability } from "@/lib/tickets-api";

function makeSector(
  overrides: Partial<SectorWithAvailability> = {},
): SectorWithAvailability {
  return {
    id: "sector-id-1",
    match_id: "match-id-1",
    sector_name: "TRIBUNA",
    total_seats: 100,
    sold_seats: 0,
    price: 5000,
    available_seats: 100,
    is_sold_out: false,
    ...overrides,
  } as SectorWithAvailability;
}

describe("buildSlotMap", () => {
  it("returns all four slots as null when given an empty array", () => {
    const result = buildSlotMap([]);
    expect(result).toEqual({
      TRIBUNA: null,
      LATERAL: null,
      "GOL NORD": null,
      "GOL SUD": null,
    });
  });

  it("populates a known slot when a matching sector is supplied", () => {
    const tribuna = makeSector({ sector_name: "TRIBUNA" });
    const result = buildSlotMap([tribuna]);
    expect(result.TRIBUNA).toBe(tribuna);
    expect(result.LATERAL).toBeNull();
    expect(result["GOL NORD"]).toBeNull();
    expect(result["GOL SUD"]).toBeNull();
  });

  it("populates multiple slots when multiple known sectors are supplied", () => {
    const tribuna = makeSector({ id: "a", sector_name: "TRIBUNA" });
    const lateral = makeSector({ id: "b", sector_name: "LATERAL" });
    const result = buildSlotMap([tribuna, lateral]);
    expect(result.TRIBUNA).toBe(tribuna);
    expect(result.LATERAL).toBe(lateral);
    expect(result["GOL NORD"]).toBeNull();
    expect(result["GOL SUD"]).toBeNull();
  });

  it("handles all four known sector names at once", () => {
    const t = makeSector({ id: "1", sector_name: "TRIBUNA" });
    const l = makeSector({ id: "2", sector_name: "LATERAL" });
    const n = makeSector({ id: "3", sector_name: "GOL NORD" });
    const s = makeSector({ id: "4", sector_name: "GOL SUD" });
    const result = buildSlotMap([t, l, n, s]);
    expect(result).toEqual({
      TRIBUNA: t,
      LATERAL: l,
      "GOL NORD": n,
      "GOL SUD": s,
    });
  });

  it("ignores sectors with an unknown sector_name without throwing", () => {
    const unknown = makeSector({
      sector_name: "UNKNOWN_SECTION" as SectorWithAvailability["sector_name"],
    });
    expect(() => buildSlotMap([unknown])).not.toThrow();
    const result = buildSlotMap([unknown]);
    expect(result).toEqual({
      TRIBUNA: null,
      LATERAL: null,
      "GOL NORD": null,
      "GOL SUD": null,
    });
  });

  it("uses the last sector when multiple share the same sector_name", () => {
    const a = makeSector({ id: "first", sector_name: "TRIBUNA" });
    const b = makeSector({ id: "second", sector_name: "TRIBUNA" });
    expect(buildSlotMap([a, b]).TRIBUNA).toBe(b);
  });
});

describe("describeSector", () => {
  it('returns a "hamarosan elérhető" description for a null sector', () => {
    const result = describeSector("TRIBUNA", null);
    expect(result).toBe("TRIBUNA szektor — hamarosan elérhető");
  });

  it('returns a "betelt" description for a sold-out sector', () => {
    const sector = makeSector({ is_sold_out: true });
    const result = describeSector("LATERAL", sector);
    expect(result).toBe("LATERAL szektor — betelt");
  });

  it("includes the available seat count for an available sector", () => {
    const sector = makeSector({
      available_seats: 42,
      is_sold_out: false,
      price: 5000,
    });
    const result = describeSector("TRIBUNA", sector);
    expect(result).toContain("42 szabad hely");
  });

  it("includes the formatted price for an available sector", () => {
    const sector = makeSector({
      available_seats: 10,
      is_sold_out: false,
      price: 5000,
    });
    const result = describeSector("TRIBUNA", sector);
    // formatPrice always appends " Ft" — verify it shows up.
    expect(result).toContain("Ft");
    expect(result).toContain("jegyenként");
  });

  it("includes the sector name verbatim", () => {
    const sector = makeSector();
    expect(describeSector("GOL NORD", sector)).toContain("GOL NORD");
    expect(describeSector("GOL SUD", null)).toContain("GOL SUD");
  });

  it("returns a string type for every branch", () => {
    expect(typeof describeSector("TRIBUNA", null)).toBe("string");
    expect(typeof describeSector("TRIBUNA", makeSector({ is_sold_out: true }))).toBe(
      "string",
    );
    expect(typeof describeSector("TRIBUNA", makeSector())).toBe("string");
  });
});
