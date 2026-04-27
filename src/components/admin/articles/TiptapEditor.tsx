"use client";

import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Rich text editor wrapper around Tiptap (already on the dependency list
 * via @tiptap/react + @tiptap/starter-kit).
 *
 * The toolbar is intentionally minimal — admins write match reports and
 * news pieces, not blog essays. Headings (h1, h2), bold, italic, strike,
 * lists, blockquote, link, and undo/redo cover 95% of the cases. The
 * remaining 5% can fall back to raw HTML by editing in the database.
 */
export function TiptapEditor({
  value,
  onChange,
  placeholder = "Kezdj el írni…",
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false, // SSR-safe per Tiptap docs
    editorProps: {
      attributes: {
        class: "tiptap-editor px-4 py-3 min-h-[280px] focus:outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Keep the editor in sync if the parent rewrites `value` (e.g. switching
  // from "create" to "edit" on the same mount).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-muted)]">
        Szerkesztő betöltése...
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-[var(--glass-border)] bg-[var(--bg-primary)]",
        "focus-within:border-[var(--accent-gold)] focus-within:ring-2 focus-within:ring-[var(--accent-gold)]/30",
        className,
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}

interface ToolbarButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded transition-colors duration-150",
        "text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active &&
          "bg-[var(--accent-gold)]/15 text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/15",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--glass-border)]" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--glass-border)] bg-[var(--bg-tertiary)]/40 px-2 py-1.5">
      <ToolbarButton
        label="Félkövér"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Dőlt"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Áthúzott"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        label="H1 cím"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="H2 cím"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        label="Pontozott lista"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Számozott lista"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Idézet"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        label="Link beszúrása"
        onClick={() => {
          const previousUrl = editor.getAttributes("link").href as
            | string
            | undefined;
          const url = window.prompt("Cél URL", previousUrl ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          // StarterKit only includes link in v3+; gracefully no-op if the
          // mark isn't available in the current build.
          if ("link" in editor.schema.marks) {
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setMark("link", { href: url, target: "_blank", rel: "noopener" })
              .run();
          }
        }}
      >
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarSeparator />
      <ToolbarButton
        label="Visszavonás"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Újra"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
