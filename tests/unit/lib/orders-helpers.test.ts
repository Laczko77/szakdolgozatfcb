import { describe, it, expect } from "vitest";
import {
  parseOptionalCouponCode,
  parseShippingAddress,
} from "@/app/api/orders/_helpers";

const validAddress = {
  full_name: "Iniesta Andrés",
  country: "Spanyolország",
  city: "Barcelona",
  postal_code: "08028",
  street: "Carrer d'Aristides Maillol",
};

describe("parseShippingAddress", () => {
  it("returns the parsed ShippingAddress when all required fields are valid", () => {
    const body = { shipping_address: { ...validAddress } };
    const result = parseShippingAddress(body);
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toEqual(validAddress);
  });

  it("includes phone when provided as a non-empty string", () => {
    const body = {
      shipping_address: { ...validAddress, phone: "+36 30 123 4567" },
    };
    const result = parseShippingAddress(body);
    expect(result).not.toBeInstanceOf(Error);
    expect(result).toEqual({ ...validAddress, phone: "+36 30 123 4567" });
  });

  it("omits phone when it is missing", () => {
    const body = { shipping_address: { ...validAddress } };
    const result = parseShippingAddress(body);
    expect(result).not.toBeInstanceOf(Error);
    expect((result as unknown as Record<string, unknown>).phone).toBeUndefined();
  });

  it("omits phone when it is whitespace-only", () => {
    const body = { shipping_address: { ...validAddress, phone: "   " } };
    const result = parseShippingAddress(body);
    expect(result).not.toBeInstanceOf(Error);
    expect((result as unknown as Record<string, unknown>).phone).toBeUndefined();
  });

  it("trims whitespace on every required field", () => {
    const body = {
      shipping_address: {
        full_name: "  Iniesta Andrés  ",
        country: "  Spanyolország  ",
        city: "  Barcelona  ",
        postal_code: "  08028  ",
        street: "  Carrer  ",
      },
    };
    const result = parseShippingAddress(body);
    expect(result).toEqual({
      full_name: "Iniesta Andrés",
      country: "Spanyolország",
      city: "Barcelona",
      postal_code: "08028",
      street: "Carrer",
    });
  });

  it("returns an Error for a null body", () => {
    expect(parseShippingAddress(null)).toBeInstanceOf(Error);
  });

  it("returns an Error for a primitive body", () => {
    expect(parseShippingAddress("not-an-object")).toBeInstanceOf(Error);
    expect(parseShippingAddress(42)).toBeInstanceOf(Error);
  });

  it("returns an Error when shipping_address is missing", () => {
    const result = parseShippingAddress({});
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("shipping_address");
  });

  it("returns an Error when shipping_address is not an object", () => {
    const result = parseShippingAddress({ shipping_address: "string" });
    expect(result).toBeInstanceOf(Error);
  });

  it.each([
    "full_name",
    "country",
    "city",
    "postal_code",
    "street",
  ] as const)("returns an Error when '%s' is missing", (field) => {
    const incomplete = { ...validAddress };
    delete (incomplete as Record<string, unknown>)[field];
    const result = parseShippingAddress({ shipping_address: incomplete });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain(field);
  });

  it.each([
    "full_name",
    "country",
    "city",
    "postal_code",
    "street",
  ] as const)(
    "returns an Error when '%s' is whitespace-only",
    (field) => {
      const result = parseShippingAddress({
        shipping_address: { ...validAddress, [field]: "   " },
      });
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain(field);
    },
  );

  it("returns an Error when a required field is a non-string type", () => {
    const result = parseShippingAddress({
      shipping_address: { ...validAddress, city: 123 },
    });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("city");
  });
});

describe("parseOptionalCouponCode", () => {
  it("returns null when coupon_code is undefined (omitted)", () => {
    expect(parseOptionalCouponCode({})).toBeNull();
  });

  it("returns null when coupon_code is explicitly null", () => {
    expect(parseOptionalCouponCode({ coupon_code: null })).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseOptionalCouponCode({ coupon_code: "" })).toBeNull();
  });

  it("returns null for a whitespace-only string (after trim)", () => {
    expect(parseOptionalCouponCode({ coupon_code: "   " })).toBeNull();
  });

  it("returns the trimmed code for a valid string", () => {
    expect(parseOptionalCouponCode({ coupon_code: "  BARCA-1234  " })).toBe(
      "BARCA-1234",
    );
  });

  it("returns the unchanged code when it has no surrounding whitespace", () => {
    expect(parseOptionalCouponCode({ coupon_code: "BARCA-1234" })).toBe(
      "BARCA-1234",
    );
  });

  it("returns an Error when coupon_code is a non-string type", () => {
    const result = parseOptionalCouponCode({ coupon_code: 42 });
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toContain("coupon_code");
  });

  it("returns an Error for a null body", () => {
    expect(parseOptionalCouponCode(null)).toBeInstanceOf(Error);
  });

  it("returns an Error for a non-object body", () => {
    expect(parseOptionalCouponCode("string")).toBeInstanceOf(Error);
  });
});
