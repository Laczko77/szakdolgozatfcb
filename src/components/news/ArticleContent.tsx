import { cn } from "@/lib/utils";

interface ArticleContentProps {
  content: string;
}

/**
 * Plain-text article body renderer with magazine-grade typography.
 *
 * The CMS currently stores content as plain text (Tiptap rich-text
 * comes in F15) — so we split on blank lines into paragraphs, render
 * single line breaks as soft `<br>`, and let the prose styles take
 * care of the rest.  Once the admin editor produces HTML/JSON output,
 * this component becomes the renderer for that.
 */
export function ArticleContent({ content }: ArticleContentProps) {
  const paragraphs = splitParagraphs(content);

  if (paragraphs.length === 0) {
    return (
      <p className="text-base text-[var(--text-muted)] italic">
        A cikk tartalma nem érhető el.
      </p>
    );
  }

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
            // First paragraph drop-cap effect — pure CSS, only on the
            // first lead paragraph and only on >=sm where there's room.
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
