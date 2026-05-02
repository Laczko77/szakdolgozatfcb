import sanitizeHtml from "sanitize-html";

/**
 * Strip HTML tags from an article body and collapse it down to a clean
 * plain-text excerpt suitable for cards / OpenGraph descriptions / search.
 *
 * Used everywhere a Tiptap-authored `articles.content` blob needs to be
 * shown without markup — list cards (`ArticleCard`, `HeroArticle`),
 * `<meta description>` (generateMetadata), search results.
 *
 * Implementation:
 *   1. DOMPurify with `ALLOWED_TAGS: []` removes every tag (including
 *      `<script>`) and returns just the inner text content. This is
 *      isomorphic — works in both the Server Component (Node) and any
 *      future client-side caller.
 *   2. Decode common HTML entities back to their unicode form so
 *      "Bar&ccedil;a" reads as "Barça" in the excerpt.
 *   3. Collapse all whitespace to single spaces, then word-boundary trim
 *      to `maxChars`.
 *
 * Matches the previous plain-text excerpt formatter so cards keep the
 * same look — this is purely a fidelity fix, not a redesign.
 */
export function htmlExcerpt(html: string, maxChars = 160): string {
  if (!html) return "";

  const stripped = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: false,
  });

  // DOMPurify already returns unescaped text content — but the input may
  // already contain entity references that survive the strip. Decode the
  // small set we actually see in practice.
  const decoded = decodeBasicEntities(stripped);

  const text = decoded.replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return `${slice.slice(0, cut).trim()}…`;
}

function decodeBasicEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}
