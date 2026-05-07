import { describe, it, expect } from "vitest";
import { mapBusinessRuleError } from "@/app/api/shop/coupons/[id]/redeem/_helpers";

describe("mapBusinessRuleError", () => {
  it("maps a 'nem található' message to 404", () => {
    const result = mapBusinessRuleError("A kupon nem található");
    expect(result).toEqual({ status: 404, message: "Kupon nem található" });
  });

  it("maps a 'nem érhető el' message to 400", () => {
    const result = mapBusinessRuleError("Ez a kupon nem érhető el");
    expect(result).toEqual({
      status: 400,
      message: "Ez a kupon már nem elérhető",
    });
  });

  it("maps a 'nincs elég pont' message to 400", () => {
    const result = mapBusinessRuleError("Nincs elég pontod");
    expect(result).toEqual({
      status: 400,
      message: "Nincs elég pont a beváltáshoz",
    });
  });

  it("maps a 'már fel lett használva' message to 409", () => {
    const result = mapBusinessRuleError("Ez a kupon már fel lett használva");
    expect(result).toEqual({
      status: 409,
      message: "Ez a kupon már fel lett használva",
    });
  });

  it("maps an 'egyedi kuponkódot' message to 503", () => {
    const result = mapBusinessRuleError(
      "Nem sikerült egyedi kuponkódot generálni",
    );
    expect(result).toEqual({
      status: 503,
      message: "Pillanatnyi hiba a kuponkód generálásakor — próbáld újra",
    });
  });

  it("returns 400 with the original message for an unknown error", () => {
    const raw = "Valami egyedi DB hiba";
    const result = mapBusinessRuleError(raw);
    expect(result).toEqual({ status: 400, message: raw });
  });

  it("matches case-insensitively when the input is uppercase", () => {
    const result = mapBusinessRuleError("KUPON NEM TALÁLHATÓ");
    expect(result).toEqual({ status: 404, message: "Kupon nem található" });
  });

  it("matches case-insensitively for mixed case", () => {
    const result = mapBusinessRuleError("Coupon Nem ÉrheTŐ El");
    expect(result.status).toBe(400);
    expect(result.message).toBe("Ez a kupon már nem elérhető");
  });

  it("prefers the first matching keyword when multiple are present", () => {
    // 'nem található' is checked before 'nem érhető el' in the chain.
    const result = mapBusinessRuleError(
      "kupon nem található — és egyébként sem érhető el",
    );
    expect(result.status).toBe(404);
  });

  it("returns an object with both status and message keys", () => {
    const result = mapBusinessRuleError("akármi");
    expect(typeof result.status).toBe("number");
    expect(typeof result.message).toBe("string");
  });
});
