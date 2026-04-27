"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Global state for the F10 command palette.
 *
 * Two consumers need to write to this state:
 *   - The Navbar / MobileHeader search icons (open the palette).
 *   - The CommandPalette itself (close the palette).
 *
 * Every other reader just needs `isOpen`. Wrapping in Context is overkill
 * for a single boolean — but it keeps the keyboard shortcut (Ctrl/Cmd+K)
 * registration centralised here, so any rendering of `<CommandPalette />`
 * automatically gets the global hotkey for free.
 */

interface SearchContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Mounted once at the top of the app tree. Owns the palette's open/closed
 * state and the global Ctrl/Cmd+K keyboard listener.
 *
 * The actual palette UI is rendered separately by `<CommandPalette />`,
 * which subscribes to this context. We keep the two split because the
 * palette is heavy (debounced fetches, animation, focus-trap) and we
 * don't want to mount it eagerly with every page.
 */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  // Global Ctrl/Cmd+K shortcut — bound to `window` so it works regardless
  // of where the focus is. We deliberately match VS Code / Linear / GitHub
  // conventions so muscle memory carries over for power users.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      if (e.key.toLowerCase() !== "k") return;

      // Don't hijack the shortcut when the user is mid-edit in a text field
      // — that's surprising.
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        (t && t.isContentEditable)
      ) {
        // If it's our OWN palette input, the palette handles Escape itself;
        // we still want Ctrl+K to toggle even from inside the palette so
        // power users can dismiss with the same key. So we let it fall through.
        if (!t?.closest("[data-command-palette]")) return;
      }

      e.preventDefault();
      setIsOpen((v) => !v);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Lock body scroll while open — the palette is a fullscreen overlay and
  // background scrolling under a modal feels broken.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  const value = useMemo<SearchContextValue>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
}

export function useSearchPalette(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error(
      "useSearchPalette must be used inside <SearchProvider />",
    );
  }
  return ctx;
}
