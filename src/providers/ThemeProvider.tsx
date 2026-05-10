"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "barca-theme";

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => undefined,
  setTheme: () => undefined,
});

/**
 * Reads the same source-of-truth that the inline flash-prevention script
 * has already written to <html data-theme="...">. By reading from the
 * DOM rather than re-checking localStorage on mount, we avoid hydration
 * mismatches and never flicker.
 */
function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => readInitialTheme());

  const applyTheme = useCallback((next: Theme) => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be unavailable (SSR, private mode) — ignore.
    }
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      applyTheme(next);
    },
    [applyTheme],
  );

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  // On first client render, sync the React state with whatever the inline
  // script set on <html>. This means state and DOM never disagree.
  useEffect(() => {
    const current = readInitialTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(current);
  }, []);

  // Listen for OS-level theme changes ONLY when the user has not yet set
  // an explicit preference. Once they choose, we respect that forever.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasExplicitChoice = (() => {
      try {
        return Boolean(window.localStorage.getItem(STORAGE_KEY));
      } catch {
        return false;
      }
    })();

    if (hasExplicitChoice) return;

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      const next: Theme = e.matches ? "light" : "dark";
      setThemeState(next);
      document.documentElement.setAttribute("data-theme", next);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Inline script body that runs BEFORE React hydration, set by the root layout
 * via dangerouslySetInnerHTML. It reads the persisted theme (or the OS pref)
 * and writes data-theme on <html> synchronously, eliminating the white flash.
 */
export const themeFlashPreventionScript = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var theme;
    if (stored === 'dark' || stored === 'light') {
      theme = stored;
    } else {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;
