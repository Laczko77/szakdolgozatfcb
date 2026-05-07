import { describe, it, expect } from "vitest";
import { extractProductId } from "@/hooks/usePageTracking.helpers";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";
const VALID_UUID_UPPER = "11111111-2222-3333-4444-555555555555".toUpperCase();

describe("extractProductId", () => {
  it("extracts the UUID from a /shop/<uuid> path", () => {
    expect(extractProductId(`/shop/${VALID_UUID}`)).toBe(VALID_UUID);
  });

  it("normalises an uppercase UUID to lowercase", () => {
    expect(extractProductId(`/shop/${VALID_UUID_UPPER}`)).toBe(VALID_UUID);
  });

  it("returns null for /shop/<non-uuid slug>", () => {
    expect(extractProductId("/shop/some-slug")).toBeNull();
  });

  it("returns null for an unrelated path like /hirek/...", () => {
    expect(extractProductId("/hirek/valami")).toBeNull();
  });

  it("returns null for /shop with a trailing slash and no slug", () => {
    expect(extractProductId("/shop/")).toBeNull();
  });

  it("returns null for /shop with no trailing segment at all", () => {
    expect(extractProductId("/shop")).toBeNull();
  });

  it("handles a path that has a query string after the UUID", () => {
    expect(extractProductId(`/shop/${VALID_UUID}?ref=email`)).toBe(VALID_UUID);
  });

  it("handles a path that has a hash after the UUID", () => {
    expect(extractProductId(`/shop/${VALID_UUID}#details`)).toBe(VALID_UUID);
  });

  it("handles a path with extra trailing segments after the UUID", () => {
    // The regex captures only the first segment after /shop/, so /shop/<uuid>/foo
    // still resolves to the UUID.
    expect(extractProductId(`/shop/${VALID_UUID}/foo`)).toBe(VALID_UUID);
  });

  it("returns null for the empty string", () => {
    expect(extractProductId("")).toBeNull();
  });

  it("returns null for the bare root path", () => {
    expect(extractProductId("/")).toBeNull();
  });

  it("returns null when the UUID is malformed (wrong segment lengths)", () => {
    expect(extractProductId("/shop/1111-2222-3333-4444-555555555555")).toBeNull();
  });

  it("returns null when the UUID has non-hex characters", () => {
    expect(
      extractProductId("/shop/zzzzzzzz-2222-3333-4444-555555555555"),
    ).toBeNull();
  });
});
