import sanitizeHtml from "sanitize-html";
import { cn } from "@/lib/utils";

interface ArticleContentProps {
  content: string;
}

/**
 * Article body renderer — HTML (Tiptap) + plain-text aware.
 *
 * Background (F18.4 fix):
 *   The F15 admin panel ships a Tiptap rich-text editor that persists
 *   `articles.content` as HTML (`<p>`, `<h2>`, `<strong>`, `<a>` …).
 *   Until this fix the public detail page rendered the raw string,
 *   so visitors saw the literal markup. We now sanitise the HTML with
 *   `isomorphic-dompurify` (allows the editor's tag set, strips
 *   `<script>` / `on*` handlers / external `javascript:` urls) and
 *   inject it via `dangerouslySetInnerHTML`.
 *
 *   Legacy plain-text articles (no tags) still work — `looksLikeHtml`
 *   detects them and falls back to the previous paragraph-splitting
 *   renderer with the gold drop-cap.
 *
 * Typography:
 *   We don't pull in `@tailwindcss/typography` — that plugin's stock
 *   look fights the FCB liquid-glass aesthetic. Instead we hand-rolled
 *   the prose styling against design tokens (`--text-primary`,
 *   `--accent-gold`, `--glass-border`). The result reads like an
 *   editorial broadsheet without abandoning the system.
 */
export function ArticleContent({ content }: ArticleContentProps) {
  const trimmed = content?.trim() ?? "";

  if (trimmed.length === 0) {
    return (
      <p className="text-base text-[var(--text-muted)] italic">
        A cikk tartalma nem érhető el.
      </p>
    );
  }

  if (looksLikeHtml(trimmed)) {
    // ── HTML branch (Tiptap) ─────────────────────────────────────
    const cleanHtml = sanitizeHtml(trimmed, {
      allowedTags: [
        "p", "br", "strong", "b", "em", "i", "u", "s",
        "a", "ul", "ol", "li",
        "h1", "h2", "h3", "h4",
        "blockquote", "code", "pre", "hr", "img",
      ],
      allowedAttributes: {
        a: ["href", "title", "target", "rel"],
        img: ["src", "alt"],
      },
      // BUG-002 — force `rel="noopener noreferrer"` on every <a>.
      // The Tiptap editor allows authors to set `target="_blank"`, and
      // without the rel attribute that exposes us to reverse-tabnabbing
      // and a leaked Referer header. We overwrite any author-supplied
      // rel rather than merging — the security posture must not be
      // negotiable from inside CMS content.
      transformTags: {
        a: (tagName, attribs) => ({
          tagName,
          attribs: { ...attribs, rel: "noopener noreferrer" },
        }),
      },
    });

    return (
      <div
        className={cn(
          "fcb-prose",
          "text-base sm:text-lg leading-[1.8] tracking-[0.005em]",
          "text-[var(--text-primary)]/95",
        )}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    );
  }

  // ── Plain-text branch (legacy articles) ─────────────────────
  const paragraphs = splitParagraphs(trimmed);

  return (
    <div
      className={cn(
        "space-y-6",
        "text-base sm:text-lg leading-[1.8] tracking-[0.005em]",
        "text-[var(--text-primary)]/95",
      )}
    >
      {paragraphs.map((para, idx) => (
        <p
          key={idx}
          className={cn(
            // First paragraph drop-cap — pure CSS, only on the lead.
            idx === 0 &&
              "first-letter:font-display first-letter:text-[var(--accent-gold)] first-letter:text-7xl first-letter:leading-[0.85] first-letter:float-left first-letter:mr-3 first-letter:mt-2 sm:first-letter:text-8xl",
          )}
        >
          {renderLineBreaks(para)}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Heuristic — does the string contain HTML markup we should render via
 * DOMPurify? We look for any opening tag from the editor's whitelist.
 * Pure plain text (newline-separated paragraphs) keeps the legacy path,
 * which preserves the magazine drop-cap.
 */
function looksLikeHtml(text: string): boolean {
  return /<\/?(?:p|h[1-4]|ul|ol|li|strong|em|a|blockquote|br|img|hr|pre|code)\b/i.test(
    text,
  );
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);
}

function renderLineBreaks(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}
