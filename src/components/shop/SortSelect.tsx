"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRODUCT_SORT_KEYS,
  type ProductSortKey,
} from "@/lib/shop-api";

/**
 * Liquid-glass sort dropdown for the storefront listing (F28.1).
 *
 * A native <select> is intentionally avoided — the system-rendered dropdown
 * surface clashes with the rest of the glass UI. Instead we expose a
 * listbox-pattern popover (button + ul[role=listbox] + li[role=option])
 * with keyboard support (ArrowUp/Down, Home/End, Enter, Escape).
 */

const LABELS: Record<ProductSortKey, string> = {
  newest: "Legújabb",
  popular: "Legnépszerűbb",
  price_asc: "Ár: növekvő",
  price_desc: "Ár: csökkenő",
};

interface SortSelectProps {
  value: ProductSortKey;
  onChange: (next: ProductSortKey) => void;
  /** Compact-mode for tight desktop layouts. Defaults to false. */
  compact?: boolean;
}

export function SortSelect({
  value,
  onChange,
  compact = false,
}: SortSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(0, PRODUCT_SORT_KEYS.indexOf(value)),
  );

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync the active index to the selected value whenever the popover opens —
  // so keyboard nav starts on the current selection, not at the top.
  // Wrapped in queueMicrotask so the setState lands outside the effect body
  // (eslint-config-next + React 19 forbid synchronous setState here).
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const idx = PRODUCT_SORT_KEYS.indexOf(value);
      setActiveIndex(idx >= 0 ? idx : 0);
    });
  }, [open, value]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  // Focus the listbox when opened so keyboard users land in the right place.
  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => {
        listRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [open]);

  function commit(index: number) {
    const next = PRODUCT_SORT_KEYS[index];
    if (next && next !== value) onChange(next);
    setOpen(false);
    // Return focus to the trigger so SR + keyboard users keep context.
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % PRODUCT_SORT_KEYS.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + PRODUCT_SORT_KEYS.length) % PRODUCT_SORT_KEYS.length,
        );
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(PRODUCT_SORT_KEYS.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => buttonRef.current?.focus());
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Rendezés — jelenlegi: ${LABELS[value]}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex items-center gap-2 rounded-full border transition-colors",
          "border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md",
          "text-sm text-[var(--text-primary)]",
          "hover:border-[var(--accent-gold)] focus-visible:border-[var(--accent-gold)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]/60",
          compact ? "px-3.5 py-2" : "px-4 py-2.5",
        )}
      >
        <ArrowUpDown
          size={14}
          className="text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-gold)]"
          aria-hidden
        />
        <span className="text-[var(--text-secondary)]">Rendezés:</span>
        <span className="font-medium tracking-wide">{LABELS[value]}</span>
        <ChevronDown
          size={14}
          className={cn(
            "ml-1 text-[var(--text-muted)] transition-transform duration-200",
            open && "rotate-180 text-[var(--accent-gold)]",
          )}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              "absolute right-0 z-30 mt-2 min-w-[220px] origin-top-right",
              "glass-modal overflow-hidden rounded-2xl p-1.5",
            )}
          >
            <ul
              ref={listRef}
              role="listbox"
              aria-label="Rendezés opciók"
              tabIndex={-1}
              onKeyDown={onKeyDown}
              className="flex flex-col gap-0.5 outline-none"
            >
              {PRODUCT_SORT_KEYS.map((key, idx) => {
                const isSelected = key === value;
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={key}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => commit(idx)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm",
                      "transition-colors duration-150",
                      isActive
                        ? "bg-[var(--glass-bg-strong)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]",
                      isSelected && "text-[var(--accent-gold)]",
                    )}
                  >
                    <span className="tracking-wide">{LABELS[key]}</span>
                    {isSelected ? (
                      <Check size={14} aria-hidden />
                    ) : (
                      <span aria-hidden className="size-[14px]" />
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
