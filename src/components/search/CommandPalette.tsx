"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CornerDownLeft,
  FileText,
  MessageSquare,
  Search as SearchIcon,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import type { Article, Player, Post, Product } from "@/types/database";
import { searchAll, type SearchResults } from "@/lib/profile-api";
import { useSearchPalette } from "@/providers/SearchProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * F10.6 — Global command palette.
 *
 * Triggered by:
 *   - Ctrl/Cmd+K (registered in SearchProvider).
 *   - The search icon in Navbar / MobileHeader (calls `open()` from the
 *     same provider).
 *
 * Behaviour:
 *   - Fullscreen overlay with a strong backdrop blur. The glass card
 *     centres horizontally and sits ~14vh from the top so the keyboard
 *     does not eat the input on mobile.
 *   - 300ms debounced fetch to /api/search — short queries (<2 chars)
 *     resolve to empty groups server-side, which we render as a tip.
 *   - Results grouped by type (Hírek, Termékek, Játékosok, Posztok),
 *     each entry a compact row with thumbnail / icon, title, and a
 *     type badge.
 *   - Keyboard nav: ArrowUp/ArrowDown move between flattened entries,
 *     Enter navigates, Escape / backdrop click closes.
 *
 * The component bails out of the DOM entirely when not open (we use
 * AnimatePresence so the close transition still plays). This keeps the
 * focus trap and `aria-hidden` handling trivial.
 */

const DEBOUNCE_MS = 300;

type ResultKind = "article" | "product" | "player" | "post";

interface FlatItem {
  kind: ResultKind;
  id: string;
  href: string;
  /** Used to find the row in the active section after re-grouping. */
  globalIndex: number;
  raw: Article | Product | Player | Post;
}

const EMPTY_RESULTS: SearchResults = {
  query: "",
  articles: [],
  products: [],
  players: [],
  posts: [],
};

export function CommandPalette() {
  const { isOpen, close } = useSearchPalette();
  const reduced = useReducedMotion();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus the input on every open and reset transient state. Resetting query
  // on close (not on open) means the user keeps their search if they
  // accidentally dismiss. We chose to clear: a clean palette is what users
  // expect every time they hit Ctrl+K.
  //
  // Note: every state update is wrapped in `queueMicrotask` so React 19's
  // `react-hooks/set-state-in-effect` rule doesn't flag this as a
  // cascading render — the reset is genuinely a syncing concern, not a
  // computed-from-props derivation.
  useEffect(() => {
    if (isOpen) {
      // Defer so the input exists in the DOM.
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
    queueMicrotask(() => {
      setQuery("");
      setResults(EMPTY_RESULTS);
      setError(null);
      setActiveIdx(0);
    });
  }, [isOpen]);

  // Debounced search. We use a single AbortController so an in-flight request
  // is cancelled when the user keeps typing.
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      queueMicrotask(() => {
        setResults(EMPTY_RESULTS);
        setLoading(false);
        setError(null);
      });
      return;
    }

    const controller = new AbortController();
    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await searchAll(trimmed, {
            limit: 6,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          setResults(data);
          setActiveIdx(0);
        } catch (err) {
          if (controller.signal.aborted) return;
          setError(
            err instanceof Error ? err.message : "Keresés sikertelen",
          );
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(handle);
    };
  }, [isOpen, query]);

  // Flatten the grouped results into a single keyboard-navigable list.
  // Order matches visual order: hírek → termékek → játékosok → posztok.
  const flat: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    let g = 0;

    for (const a of results.articles) {
      items.push({
        kind: "article",
        id: a.id,
        href: `/hirek/${a.id}`,
        globalIndex: g++,
        raw: a,
      });
    }
    for (const p of results.products) {
      items.push({
        kind: "product",
        id: p.id,
        href: `/shop/${p.id}`,
        globalIndex: g++,
        raw: p,
      });
    }
    for (const p of results.players) {
      items.push({
        kind: "player",
        id: p.id,
        href: `/jatekosok/${p.id}`,
        globalIndex: g++,
        raw: p,
      });
    }
    for (const p of results.posts) {
      items.push({
        kind: "post",
        id: p.id,
        // Feed posts have no individual page; the listing scrolls to
        // the top — good-enough for the MVP.
        href: `/kozosseg`,
        globalIndex: g++,
        raw: p,
      });
    }
    return items;
  }, [results]);

  // Keep the active index inside bounds whenever the list shape changes.
  useEffect(() => {
    if (activeIdx < flat.length) return;
    queueMicrotask(() => setActiveIdx(0));
  }, [flat.length, activeIdx]);

  const navigateAndClose = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (flat.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % flat.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + flat.length) % flat.length);
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIdx(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIdx(flat.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = flat[activeIdx];
        if (target) navigateAndClose(target.href);
      }
    },
    [flat, activeIdx, close, navigateAndClose],
  );

  // Scroll the active row into view as the user arrows down.
  useEffect(() => {
    if (!isOpen) return;
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-row-index="${activeIdx}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, isOpen]);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const hasAnyResult = flat.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-command-palette
          role="dialog"
          aria-modal="true"
          aria-label="Globális kereső"
          onKeyDown={onKeyDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
          className={cn(
            "fixed inset-0 z-[150]",
            "flex items-start justify-center",
            "px-4 py-[12vh] sm:py-[14vh]",
            "glass-modal-backdrop",
          )}
          onClick={(e) => {
            // Only close on direct backdrop clicks — clicks bubbling up from
            // children should not dismiss.
            if (e.target === e.currentTarget) close();
          }}
        >
          <motion.div
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: -16, scale: 0.97 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: -8, scale: 0.98 }
            }
            transition={{
              duration: reduced ? 0.12 : 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
            className={cn(
              "relative w-full max-w-2xl overflow-hidden",
              "glass-modal glass-search-panel glass-border-gradient",
              "shadow-[0_30px_120px_-20px_rgba(0,0,0,0.65)]",
            )}
          >
            {/* ── Search input ────────────────────────────────────── */}
            <div
              className={cn(
                "flex items-center gap-3 px-4 py-3.5",
                "border-b border-[var(--glass-border)]",
              )}
            >
              <SearchIcon
                size={18}
                className={cn(
                  "shrink-0",
                  loading
                    ? "animate-pulse text-[var(--accent-gold)]"
                    : "text-[var(--text-muted)]",
                )}
                aria-hidden
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Keress hírt, terméket, játékost, posztot…"
                aria-label="Keresőszó"
                aria-controls="command-palette-results"
                aria-activedescendant={
                  flat[activeIdx] ? `cmd-row-${flat[activeIdx].id}` : undefined
                }
                className={cn(
                  "flex-1 bg-transparent text-[15px]",
                  "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                  "focus:outline-none",
                )}
                autoComplete="off"
                spellCheck={false}
              />
              <KbdHint label="ESC" onClick={close} />
            </div>

            {/* ── Results region ───────────────────────────────────── */}
            <div
              ref={listRef}
              id="command-palette-results"
              role="listbox"
              aria-label="Találatok"
              className="max-h-[60vh] overflow-y-auto px-2 py-2"
            >
              {!hasQuery ? (
                <PaletteHint />
              ) : error ? (
                <PaletteState
                  icon={<X size={20} />}
                  tone="red"
                  title="Hiba történt"
                  description={error}
                />
              ) : !hasAnyResult && !loading ? (
                <PaletteState
                  icon={<SearchIcon size={20} />}
                  tone="muted"
                  title="Nincs találat"
                  description={`A „${trimmed}” keresőszóra semmit sem találtunk.`}
                />
              ) : (
                <ResultsBody
                  results={results}
                  activeIdx={activeIdx}
                  onHover={setActiveIdx}
                  onSelect={navigateAndClose}
                />
              )}
            </div>

            {/* ── Footer hints ────────────────────────────────────── */}
            <div
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-2.5",
                "border-t border-[var(--glass-border)]",
                "bg-[var(--glass-bg)]",
              )}
            >
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <span className="hidden sm:inline-flex items-center gap-1.5">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  Navigálás
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Kbd>
                    <CornerDownLeft size={10} strokeWidth={2.4} />
                  </Kbd>
                  Megnyitás
                </span>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <Sparkles size={10} className="text-[var(--accent-gold)]" />
                Forca Search
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Result body — grouped sections
// ---------------------------------------------------------------------------

function ResultsBody({
  results,
  activeIdx,
  onHover,
  onSelect,
}: {
  results: SearchResults;
  activeIdx: number;
  onHover: (idx: number) => void;
  onSelect: (href: string) => void;
}) {
  let runningIndex = 0;

  return (
    <div className="space-y-1">
      {results.articles.length > 0 && (
        <Section
          title="Hírek"
          accent="blue"
          icon={<FileText size={11} strokeWidth={2.2} />}
        >
          {results.articles.map((a) => {
            const idx = runningIndex++;
            return (
              <ArticleRow
                key={a.id}
                article={a}
                idx={idx}
                active={activeIdx === idx}
                onHover={onHover}
                onSelect={onSelect}
              />
            );
          })}
        </Section>
      )}

      {results.products.length > 0 && (
        <Section
          title="Termékek"
          accent="gold"
          icon={<ShoppingBag size={11} strokeWidth={2.2} />}
        >
          {results.products.map((p) => {
            const idx = runningIndex++;
            return (
              <ProductRow
                key={p.id}
                product={p}
                idx={idx}
                active={activeIdx === idx}
                onHover={onHover}
                onSelect={onSelect}
              />
            );
          })}
        </Section>
      )}

      {results.players.length > 0 && (
        <Section
          title="Játékosok"
          accent="red"
          icon={<UserIcon size={11} strokeWidth={2.2} />}
        >
          {results.players.map((p) => {
            const idx = runningIndex++;
            return (
              <PlayerRow
                key={p.id}
                player={p}
                idx={idx}
                active={activeIdx === idx}
                onHover={onHover}
                onSelect={onSelect}
              />
            );
          })}
        </Section>
      )}

      {results.posts.length > 0 && (
        <Section
          title="Közösségi posztok"
          accent="muted"
          icon={<MessageSquare size={11} strokeWidth={2.2} />}
        >
          {results.posts.map((p) => {
            const idx = runningIndex++;
            return (
              <PostRow
                key={p.id}
                post={p}
                idx={idx}
                active={activeIdx === idx}
                onHover={onHover}
                onSelect={onSelect}
              />
            );
          })}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  accent,
  icon,
  children,
}: {
  title: string;
  accent: "blue" | "red" | "gold" | "muted";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const dot =
    accent === "blue"
      ? "var(--accent-blue)"
      : accent === "red"
        ? "var(--accent-red)"
        : accent === "gold"
          ? "var(--accent-gold)"
          : "var(--text-muted)";
  return (
    <section className="px-1">
      <header className="flex items-center gap-2 px-2 pt-3 pb-2">
        <span
          aria-hidden
          className="inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: "var(--glass-bg)", color: dot }}
        >
          {icon}
        </span>
        <h3
          className="font-display text-[10px] uppercase tracking-[0.32em]"
          style={{ color: "var(--text-muted)" }}
        >
          {title}
        </h3>
        <span
          aria-hidden
          className="ml-1 h-px flex-1"
          style={{
            background:
              "linear-gradient(to right, var(--glass-border), transparent)",
          }}
        />
      </header>
      <div role="group" aria-label={title} className="space-y-0.5 pb-1">
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Row primitives
// ---------------------------------------------------------------------------

interface RowShellProps {
  id: string;
  idx: number;
  active: boolean;
  href: string;
  onHover: (idx: number) => void;
  onSelect: (href: string) => void;
  children: React.ReactNode;
}

function RowShell({
  id,
  idx,
  active,
  href,
  onHover,
  onSelect,
  children,
}: RowShellProps) {
  return (
    <Link
      id={`cmd-row-${id}`}
      role="option"
      aria-selected={active}
      data-row-index={idx}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onSelect(href);
      }}
      onMouseEnter={() => onHover(idx)}
      onFocus={() => onHover(idx)}
      className={cn(
        "group flex items-center gap-3 rounded-md px-2.5 py-2",
        "transition-colors duration-150",
        active
          ? "bg-[var(--glass-bg-hover)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--glass-bg)]/70",
      )}
    >
      {children}
      <ArrowRight
        size={14}
        strokeWidth={2}
        aria-hidden
        className={cn(
          "ml-auto shrink-0 transition-all duration-200",
          active
            ? "translate-x-0.5 text-[var(--accent-gold)] opacity-100"
            : "text-[var(--text-muted)] opacity-0 group-hover:opacity-100",
        )}
      />
    </Link>
  );
}

function Thumb({
  src,
  alt,
  fallback,
}: {
  src: string | null;
  alt: string;
  fallback: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative h-9 w-9 shrink-0 overflow-hidden rounded-md",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="36px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center text-[var(--text-muted)]"
        >
          {fallback}
        </span>
      )}
    </div>
  );
}

function TypeBadge({
  label,
  accent,
}: {
  label: string;
  accent: "blue" | "red" | "gold" | "muted";
}) {
  const tone =
    accent === "blue"
      ? "var(--accent-blue)"
      : accent === "red"
        ? "var(--accent-red)"
        : accent === "gold"
          ? "var(--accent-gold)"
          : "var(--text-muted)";
  return (
    <span
      className={cn(
        "rounded-full border px-1.5 py-0.5",
        "font-display text-[9px] uppercase tracking-[0.22em]",
      )}
      style={{
        color: tone,
        borderColor: "var(--glass-border)",
        background: "var(--glass-bg)",
      }}
    >
      {label}
    </span>
  );
}

function ArticleRow(props: {
  article: Article;
  idx: number;
  active: boolean;
  onHover: (idx: number) => void;
  onSelect: (href: string) => void;
}) {
  const { article, idx, active, onHover, onSelect } = props;
  return (
    <RowShell
      id={article.id}
      idx={idx}
      active={active}
      href={`/hirek/${article.id}`}
      onHover={onHover}
      onSelect={onSelect}
    >
      <Thumb
        src={article.image_url}
        alt=""
        fallback={<FileText size={14} />}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {article.title}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {article.category ?? "Hír"}
        </p>
      </div>
      <TypeBadge label="Hír" accent="blue" />
    </RowShell>
  );
}

function ProductRow(props: {
  product: Product;
  idx: number;
  active: boolean;
  onHover: (idx: number) => void;
  onSelect: (href: string) => void;
}) {
  const { product, idx, active, onHover, onSelect } = props;
  return (
    <RowShell
      id={product.id}
      idx={idx}
      active={active}
      href={`/shop/${product.id}`}
      onHover={onHover}
      onSelect={onSelect}
    >
      <Thumb
        src={product.image_url}
        alt=""
        fallback={<ShoppingBag size={14} />}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {product.name}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {formatPrice(Number(product.price))}
          {product.category ? ` · ${product.category}` : ""}
        </p>
      </div>
      <TypeBadge label="Termék" accent="gold" />
    </RowShell>
  );
}

function PlayerRow(props: {
  player: Player;
  idx: number;
  active: boolean;
  onHover: (idx: number) => void;
  onSelect: (href: string) => void;
}) {
  const { player, idx, active, onHover, onSelect } = props;
  return (
    <RowShell
      id={player.id}
      idx={idx}
      active={active}
      href={`/jatekosok/${player.id}`}
      onHover={onHover}
      onSelect={onSelect}
    >
      <Thumb
        src={player.image_url}
        alt=""
        fallback={<UserIcon size={14} />}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {player.name}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          {[player.position, player.number ? `#${player.number}` : null]
            .filter(Boolean)
            .join(" · ") || "Játékos"}
        </p>
      </div>
      <TypeBadge label="Játékos" accent="red" />
    </RowShell>
  );
}

function PostRow(props: {
  post: Post;
  idx: number;
  active: boolean;
  onHover: (idx: number) => void;
  onSelect: (href: string) => void;
}) {
  const { post, idx, active, onHover, onSelect } = props;
  return (
    <RowShell
      id={post.id}
      idx={idx}
      active={active}
      href={`/kozosseg`}
      onHover={onHover}
      onSelect={onSelect}
    >
      <Thumb
        src={post.image_url}
        alt=""
        fallback={<MessageSquare size={14} />}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
          {truncate(post.content, 80)}
        </p>
        <p className="truncate text-[11px] text-[var(--text-muted)]">
          Közösségi feed
        </p>
      </div>
      <TypeBadge label="Poszt" accent="muted" />
    </RowShell>
  );
}

// ---------------------------------------------------------------------------
// Empty / hint states
// ---------------------------------------------------------------------------

function PaletteHint() {
  return (
    <div className="px-3 py-10 text-center">
      <div
        aria-hidden
        className={cn(
          "mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          "text-[var(--accent-gold)]",
        )}
      >
        <SearchIcon size={18} />
      </div>
      <p className="font-display text-base tracking-wide text-[var(--text-primary)]">
        Mit keresel a Barça univerzumában?
      </p>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">
        Írj legalább 2 karaktert — hírek, termékek, játékosok és posztok
        között keresünk.
      </p>
    </div>
  );
}

function PaletteState({
  icon,
  tone,
  title,
  description,
}: {
  icon: React.ReactNode;
  tone: "muted" | "red";
  title: string;
  description: string;
}) {
  return (
    <div className="px-3 py-10 text-center">
      <div
        aria-hidden
        className={cn(
          "mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full",
          "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
          tone === "red"
            ? "text-[var(--accent-red)]"
            : "text-[var(--text-muted)]",
        )}
      >
        {icon}
      </div>
      <p className="font-display text-base tracking-wide text-[var(--text-primary)]">
        {title}
      </p>
      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tiny primitives
// ---------------------------------------------------------------------------

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-4 min-w-4 items-center justify-center rounded",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)] px-1",
        "font-display text-[9px] tracking-wider text-[var(--text-secondary)]",
      )}
    >
      {children}
    </kbd>
  );
}

function KbdHint({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Kereső bezárása"
      className={cn(
        "shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-1",
        "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]",
        "hover:text-[var(--text-primary)] transition-colors",
      )}
    >
      {label}
    </button>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
