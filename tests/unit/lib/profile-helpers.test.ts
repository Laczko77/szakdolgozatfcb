import { describe, it, expect } from "vitest";
import { readBool, readFile } from "@/app/api/profile/_helpers";

describe("readBool", () => {
  it('returns true for "true"', () => {
    const fd = new FormData();
    fd.set("flag", "true");
    expect(readBool(fd, "flag")).toBe(true);
  });

  it('returns true for "1"', () => {
    const fd = new FormData();
    fd.set("flag", "1");
    expect(readBool(fd, "flag")).toBe(true);
  });

  it('returns true for "yes"', () => {
    const fd = new FormData();
    fd.set("flag", "yes");
    expect(readBool(fd, "flag")).toBe(true);
  });

  it("trims whitespace and lowercases before comparing", () => {
    const fd = new FormData();
    fd.set("flag", "  TRUE  ");
    expect(readBool(fd, "flag")).toBe(true);
  });

  it('returns false for "false"', () => {
    const fd = new FormData();
    fd.set("flag", "false");
    expect(readBool(fd, "flag")).toBe(false);
  });

  it('returns false for "0"', () => {
    const fd = new FormData();
    fd.set("flag", "0");
    expect(readBool(fd, "flag")).toBe(false);
  });

  it('returns false for "no"', () => {
    const fd = new FormData();
    fd.set("flag", "no");
    expect(readBool(fd, "flag")).toBe(false);
  });

  it("returns false for an empty string", () => {
    const fd = new FormData();
    fd.set("flag", "");
    expect(readBool(fd, "flag")).toBe(false);
  });

  it("returns false when the key is missing from the FormData", () => {
    const fd = new FormData();
    expect(readBool(fd, "flag")).toBe(false);
  });

  it("returns false for an unrelated string value", () => {
    const fd = new FormData();
    fd.set("flag", "maybe");
    expect(readBool(fd, "flag")).toBe(false);
  });
});

describe("readFile", () => {
  it("returns the File when present and non-empty", () => {
    const fd = new FormData();
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    fd.set("avatar", file);
    expect(readFile(fd, "avatar")).toBe(file);
  });

  it("returns null when the File is empty (size 0)", () => {
    const fd = new FormData();
    const file = new File([], "empty.txt", { type: "text/plain" });
    fd.set("avatar", file);
    expect(readFile(fd, "avatar")).toBeNull();
  });

  it("returns null when the key is missing from the FormData", () => {
    const fd = new FormData();
    expect(readFile(fd, "avatar")).toBeNull();
  });

  it("returns null when the value is a string instead of a File", () => {
    const fd = new FormData();
    fd.set("avatar", "not-a-file");
    expect(readFile(fd, "avatar")).toBeNull();
  });

  it("preserves the original File reference (no clone or copy)", () => {
    const fd = new FormData();
    const file = new File(["abc"], "a.png", { type: "image/png" });
    fd.set("avatar", file);
    const result = readFile(fd, "avatar");
    expect(result).toBe(file);
    expect(result?.name).toBe("a.png");
    expect(result?.size).toBe(3);
  });
});
