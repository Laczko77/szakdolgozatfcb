import { describe, it, expect } from "vitest";
import { clampInt, escapeIlike } from "@/app/api/search/_helpers";

describe("escapeIlike", () => {
  it("returns a normal string unchanged when there are no special characters", () => {
    expect(escapeIlike("messi")).toBe("messi");
  });

  it("escapes a percent sign", () => {
    expect(escapeIlike("50%")).toBe("50\\%");
  });

  it("escapes an underscore", () => {
    expect(escapeIlike("foo_bar")).toBe("foo\\_bar");
  });

  it("escapes a backslash", () => {
    // The implementation doubles backslashes BEFORE escaping % / _, so a raw
    // input "\" becomes "\\\\".
    expect(escapeIlike("\\")).toBe("\\\\");
  });

  it("escapes percent and underscore together", () => {
    expect(escapeIlike("50%_sale")).toBe("50\\%\\_sale");
  });

  it("returns an empty string for empty input", () => {
    expect(escapeIlike("")).toBe("");
  });

  it("escapes a comma with a backslash", () => {
    expect(escapeIlike("foo,bar")).toBe("foo\\,bar");
  });

  it("replaces parens with spaces and trims the result", () => {
    // ( and ) are PostgREST or-list delimiters — the helper drops them.
    expect(escapeIlike("(messi)")).toBe("messi");
  });

  it("trims trailing whitespace produced by the paren replacement", () => {
    expect(escapeIlike("messi)")).toBe("messi");
  });

  it("handles a long string with multiple special characters", () => {
    expect(escapeIlike("a%b_c\\d,e(f)g")).toBe("a\\%b\\_c\\\\d\\,e f g");
  });

  it("returns a string type", () => {
    expect(typeof escapeIlike("anything")).toBe("string");
  });
});

describe("clampInt", () => {
  it("returns the fallback for a null input", () => {
    expect(clampInt(null, 10, 1, 50)).toBe(10);
  });

  it("returns the fallback for a non-numeric string", () => {
    expect(clampInt("abc", 10, 1, 50)).toBe(10);
  });

  it("parses a valid integer string", () => {
    expect(clampInt("5", 10, 1, 50)).toBe(5);
  });

  it("clamps a value below the minimum to the minimum", () => {
    expect(clampInt("0", 10, 1, 50)).toBe(1);
  });

  it("clamps a negative value to the minimum", () => {
    expect(clampInt("-5", 10, 1, 50)).toBe(1);
  });

  it("clamps a value above the maximum to the maximum", () => {
    expect(clampInt("999", 10, 1, 50)).toBe(50);
  });

  it("returns the value unchanged when exactly at the minimum", () => {
    expect(clampInt("1", 10, 1, 50)).toBe(1);
  });

  it("returns the value unchanged when exactly at the maximum", () => {
    expect(clampInt("50", 10, 1, 50)).toBe(50);
  });

  it("uses parseInt semantics (parses leading digits and stops)", () => {
    // Number.parseInt('12abc', 10) === 12 — the function inherits that.
    expect(clampInt("12abc", 10, 1, 50)).toBe(12);
  });

  it("returns a number type", () => {
    expect(typeof clampInt("5", 10, 1, 50)).toBe("number");
  });
});
