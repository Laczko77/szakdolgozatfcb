import { describe, it, expect } from "vitest";
import { parsePurchasePayload } from "@/app/api/tickets/purchase/_helpers";

const baseValid = {
  match_id: "11111111-1111-1111-1111-111111111111",
  sector_id: "22222222-2222-2222-2222-222222222222",
  quantity: 2,
};

describe("parsePurchasePayload", () => {
  it("returns an Error for a null body", () => {
    expect(parsePurchasePayload(null)).toBeInstanceOf(Error);
  });

  it("returns an Error for a non-object body", () => {
    expect(parsePurchasePayload("oops")).toBeInstanceOf(Error);
    expect(parsePurchasePayload(42)).toBeInstanceOf(Error);
  });

  it("returns the parsed payload with coupon_code: null when omitted", () => {
    const result = parsePurchasePayload({ ...baseValid });
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toEqual({ ...baseValid, coupon_code: null });
  });

  it("returns the parsed payload with the trimmed coupon_code when supplied", () => {
    const result = parsePurchasePayload({
      ...baseValid,
      coupon_code: "  BARCA-1234  ",
    });
    expect(result).toEqual({ ...baseValid, coupon_code: "BARCA-1234" });
  });

  it("treats explicit null coupon_code the same as omitted", () => {
    const result = parsePurchasePayload({ ...baseValid, coupon_code: null });
    expect(result).toEqual({ ...baseValid, coupon_code: null });
  });

  it("treats a whitespace-only coupon_code as null", () => {
    const result = parsePurchasePayload({ ...baseValid, coupon_code: "   " });
    expect(result).toEqual({ ...baseValid, coupon_code: null });
  });

  it("returns an Error when match_id is missing", () => {
    const { match_id: _omit, ...rest } = baseValid;
    void _omit;
    const result = parsePurchasePayload(rest);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("match_id");
  });

  it("returns an Error when match_id is empty/whitespace", () => {
    const result = parsePurchasePayload({ ...baseValid, match_id: "  " });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("match_id");
  });

  it("returns an Error when sector_id is missing", () => {
    const { sector_id: _omit, ...rest } = baseValid;
    void _omit;
    const result = parsePurchasePayload(rest);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("sector_id");
  });

  it("returns an Error when quantity is missing", () => {
    const { quantity: _omit, ...rest } = baseValid;
    void _omit;
    const result = parsePurchasePayload(rest);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("quantity");
  });

  it("returns an Error when quantity is a string", () => {
    const result = parsePurchasePayload({ ...baseValid, quantity: "2" });
    expect(result).toBeInstanceOf(Error);
  });

  it("returns an Error when quantity is below 1", () => {
    const result = parsePurchasePayload({ ...baseValid, quantity: 0 });
    expect(result).toBeInstanceOf(Error);
  });

  it("returns an Error when quantity is above 4", () => {
    const result = parsePurchasePayload({ ...baseValid, quantity: 5 });
    expect(result).toBeInstanceOf(Error);
  });

  it("returns an Error when quantity is a non-integer like 1.5", () => {
    const result = parsePurchasePayload({ ...baseValid, quantity: 1.5 });
    expect(result).toBeInstanceOf(Error);
  });

  it("accepts quantity = 1 (lower bound)", () => {
    const result = parsePurchasePayload({ ...baseValid, quantity: 1 });
    expect(result).not.toBeInstanceOf(Error);
    expect((result as { quantity: number }).quantity).toBe(1);
  });

  it("accepts quantity = 4 (upper bound)", () => {
    const result = parsePurchasePayload({ ...baseValid, quantity: 4 });
    expect(result).not.toBeInstanceOf(Error);
    expect((result as { quantity: number }).quantity).toBe(4);
  });

  it("returns an Error when coupon_code is a non-string type", () => {
    const result = parsePurchasePayload({ ...baseValid, coupon_code: 42 });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("coupon_code");
  });
});
