import { describe, it, expect } from "vitest";
import { htmlExcerpt } from "@/lib/html-excerpt";

describe("htmlExcerpt", () => {
  // ── Falsy / empty input ────────────────────────────────────────────────────

  it("returns empty string for empty string input", () => {
    expect(htmlExcerpt("")).toBe("");
  });

  it("returns empty string for a string of only whitespace (treated as falsy-ish after trim)", () => {
    // The function guards with `if (!html)` — a whitespace-only string is
    // truthy, so it goes through the pipeline and returns "" after trim.
    expect(htmlExcerpt("   ")).toBe("");
  });

  // ── Plain text — no HTML ───────────────────────────────────────────────────

  it("returns unchanged text when input has no tags and is shorter than maxChars", () => {
    expect(htmlExcerpt("Hello world")).toBe("Hello world");
  });

  it("returns unchanged text that is exactly 160 characters long (default maxChars)", () => {
    const text = "a".repeat(160);
    expect(htmlExcerpt(text)).toBe(text);
  });

  it("returns unchanged text that is exactly 1 character shorter than maxChars", () => {
    const text = "a".repeat(159);
    expect(htmlExcerpt(text)).toBe(text);
  });

  // ── HTML tag stripping ─────────────────────────────────────────────────────

  it("strips simple paragraph tags", () => {
    expect(htmlExcerpt("<p>Hello world</p>")).toBe("Hello world");
  });

  it("strips nested tags and returns only the text content", () => {
    expect(htmlExcerpt("<p><strong>FC</strong> <em>Barcelona</em></p>")).toBe(
      "FC Barcelona"
    );
  });

  it("strips script tags completely (no script content leaks through)", () => {
    const result = htmlExcerpt('<script>alert("xss")</script>Safe text');
    expect(result).not.toContain("alert");
    expect(result).not.toContain("script");
    expect(result).toContain("Safe text");
  });

  it("strips anchor tags, keeping the link text", () => {
    expect(htmlExcerpt('<a href="https://example.com">Visit us</a>')).toBe(
      "Visit us"
    );
  });

  it("collapses multiple whitespace characters to a single space", () => {
    expect(htmlExcerpt("<p>Hello</p>   <p>World</p>")).toBe("Hello World");
  });

  it("trims leading and trailing whitespace", () => {
    expect(htmlExcerpt("  <p>  Hello  </p>  ")).toBe("Hello");
  });

  // ── HTML entity decoding ───────────────────────────────────────────────────

  it("decodes &amp; to &", () => {
    expect(htmlExcerpt("Foo &amp; Bar")).toBe("Foo & Bar");
  });

  it("decodes &lt; to <", () => {
    expect(htmlExcerpt("Score: 2 &lt; 3")).toBe("Score: 2 < 3");
  });

  it("decodes &gt; to >", () => {
    expect(htmlExcerpt("Score: 3 &gt; 2")).toBe("Score: 3 > 2");
  });

  it("decodes &quot; to \"", () => {
    expect(htmlExcerpt("He said &quot;Visca&quot;")).toBe('He said "Visca"');
  });

  it("decodes &nbsp; to a regular space", () => {
    const result = htmlExcerpt("Hello&nbsp;World");
    // After entity decode and whitespace collapse, words should be separated
    // by a single regular space (char code 32).
    expect(result).toBe("Hello World");
    expect(result.charCodeAt(5)).toBe(32);
  });

  it("decodes &#39; to single quote", () => {
    expect(htmlExcerpt("Bar&#39;s goal")).toBe("Bar's goal");
  });

  it("decodes &apos; to single quote", () => {
    expect(htmlExcerpt("Bar&apos;s goal")).toBe("Bar's goal");
  });

  // ── Truncation at word boundary ────────────────────────────────────────────

  it("truncates text longer than default maxChars (160) at a word boundary and appends ellipsis", () => {
    // Build a string of whole words totalling > 160 chars.
    // Words: 20 repetitions of "Barcelona " (10 chars each) = 200 chars.
    const input = "Barcelona ".repeat(20).trim();
    const result = htmlExcerpt(input);

    expect(result.endsWith("…")).toBe(true);
    // Result body (without the ellipsis) must be <= 160 chars.
    expect(result.slice(0, -1).length).toBeLessThanOrEqual(160);
    // Must not cut in the middle of "Barcelona".
    const body = result.slice(0, -1).trimEnd();
    expect(body).toMatch(/^Barcelona( Barcelona)*$/);
  });

  it("truncates to a custom maxChars and appends ellipsis", () => {
    const input = "one two three four five six";
    const result = htmlExcerpt(input, 10);

    expect(result.endsWith("…")).toBe(true);
    // The slice before ellipsis must be at most 10 chars of real content.
    expect(result.slice(0, -1).trimEnd().length).toBeLessThanOrEqual(10);
  });

  it("does NOT truncate when text equals exactly maxChars", () => {
    const text = "a".repeat(50);
    expect(htmlExcerpt(text, 50)).toBe(text);
    expect(htmlExcerpt(text, 50).endsWith("…")).toBe(false);
  });

  it("does NOT truncate when text is shorter than custom maxChars", () => {
    expect(htmlExcerpt("Short text", 200)).toBe("Short text");
  });

  it("truncates HTML content that results in long plain text", () => {
    const word = "Messi ";
    const html = `<p>${word.repeat(30).trim()}</p>`;
    const result = htmlExcerpt(html, 40);

    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, -1).trimEnd().length).toBeLessThanOrEqual(40);
    expect(result).not.toContain("<p>");
  });

  // ── Combined HTML + entity + truncation ───────────────────────────────────

  it("strips tags, decodes entities, and truncates in one pass", () => {
    const html =
      "<p>FC Barcelona &amp; Real Madrid: " + "word ".repeat(30) + "</p>";
    const result = htmlExcerpt(html, 50);

    expect(result).not.toContain("<p>");
    expect(result).not.toContain("&amp;");
    expect(result.endsWith("…")).toBe(true);
  });
});
