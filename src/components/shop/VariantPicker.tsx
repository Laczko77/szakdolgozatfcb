"use client";

import { useMemo } from "react";
import type { ProductVariant } from "@/types/database";
import { cn } from "@/lib/utils";

interface VariantPickerProps {
  variants: ProductVariant[];
  selectedSize: string | null;
  selectedColor: string | null;
  onChange: (next: { size: string | null; color: string | null }) => void;
}

/**
 * Two-axis variant picker (size + colour).
 *
 * Behaviour:
 *   - The available sizes/colours are derived from the union of the
 *     product's variants.
 *   - When a size is chosen the colour buttons disable any colours that
 *     have zero stock for that size (and vice versa).  Selecting an
 *     unavailable cell is impossible by construction.
 *   - If a product has only sizes (no colours) the colour row collapses,
 *     and vice versa.  Real-world FCB merch tends to have both.
 *
 * This component is render-only — quantity, stock display, and "Add to
 * cart" live on the parent page so we can control loading state alongside
 * the actual mutation.
 */
export function VariantPicker({
  variants,
  selectedSize,
  selectedColor,
  onChange,
}: VariantPickerProps) {
  const allSizes = useMemo(
    () =>
      Array.from(
        new Set(variants.map((v) => v.size).filter((s): s is string => !!s)),
      ),
    [variants],
  );

  const allColors = useMemo(
    () =>
      Array.from(
        new Set(variants.map((v) => v.color).filter((c): c is string => !!c)),
      ),
    [variants],
  );

  const sizeAvailable = (size: string) =>
    variants.some(
      (v) =>
        v.size === size &&
        (selectedColor ? v.color === selectedColor : true) &&
        v.stock > 0,
    );

  const colorAvailable = (color: string) =>
    variants.some(
      (v) =>
        v.color === color &&
        (selectedSize ? v.size === selectedSize : true) &&
        v.stock > 0,
    );

  return (
    <div className="space-y-5">
      {allSizes.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              Méret
            </span>
            {selectedSize && (
              <button
                type="button"
                onClick={() => onChange({ size: null, color: selectedColor })}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Visszaállítás
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allSizes.map((size) => {
              const available = sizeAvailable(size);
              const isActive = size === selectedSize;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={!available}
                  onClick={() =>
                    onChange({ size: isActive ? null : size, color: selectedColor })
                  }
                  className={cn(
                    "min-w-[3rem] rounded-full px-4 py-2 text-sm transition-all duration-200",
                    "border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                    isActive &&
                      "border-[var(--accent-gold)] bg-[var(--glass-bg-strong)] text-[var(--text-primary)] shadow-[var(--shadow-glow-gold)]",
                    !isActive &&
                      available &&
                      "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] hover:border-[var(--glass-border-hover)]",
                    !available &&
                      "cursor-not-allowed border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-muted)] line-through opacity-50",
                  )}
                  aria-pressed={isActive}
                  aria-label={
                    available
                      ? `Méret: ${size}`
                      : `Méret: ${size} (nincs készleten)`
                  }
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {allColors.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              Szín {selectedColor && <span className="ml-2 lowercase tracking-normal text-[var(--text-primary)]">— {selectedColor}</span>}
            </span>
            {selectedColor && (
              <button
                type="button"
                onClick={() => onChange({ size: selectedSize, color: null })}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                Visszaállítás
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {allColors.map((color) => {
              const available = colorAvailable(color);
              const isActive = color === selectedColor;
              return (
                <button
                  key={color}
                  type="button"
                  disabled={!available}
                  onClick={() =>
                    onChange({ size: selectedSize, color: isActive ? null : color })
                  }
                  className={cn(
                    "relative inline-flex h-10 w-10 items-center justify-center rounded-full",
                    "border transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
                    isActive &&
                      "border-[var(--accent-gold)] shadow-[var(--shadow-glow-gold)]",
                    !isActive &&
                      available &&
                      "border-[var(--glass-border-hover)] hover:scale-110",
                    !available && "cursor-not-allowed opacity-30",
                  )}
                  aria-pressed={isActive}
                  aria-label={
                    available ? `Szín: ${color}` : `Szín: ${color} (nincs készleten)`
                  }
                  title={color}
                  style={{
                    backgroundColor: cssColorOf(color),
                  }}
                >
                  {!available && (
                    <span className="absolute inset-0 m-auto block h-[1px] w-7 rotate-45 bg-[var(--text-secondary)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Map a friendly Hungarian/English colour name to a CSS colour.
 * Falls back to the raw string so admin can also use hex codes directly.
 */
function cssColorOf(label: string): string {
  const key = label.trim().toLowerCase();
  const dictionary: Record<string, string> = {
    fekete: "#0f0f12",
    feher: "#fafafa",
    fehér: "#fafafa",
    "white": "#fafafa",
    "black": "#0f0f12",
    piros: "#a50044",
    red: "#a50044",
    kek: "#004d98",
    kék: "#004d98",
    blue: "#004d98",
    arany: "#d4a84b",
    gold: "#d4a84b",
    sarga: "#f5c211",
    sárga: "#f5c211",
    yellow: "#f5c211",
    zold: "#1a7f3c",
    zöld: "#1a7f3c",
    green: "#1a7f3c",
    szurke: "#5d6068",
    szürke: "#5d6068",
    grey: "#5d6068",
    gray: "#5d6068",
    bordo: "#7a0023",
    bordó: "#7a0023",
    granatvoros: "#8c0038",
    granatvörös: "#8c0038",
    blaugrana: "#a50044",
  };
  if (dictionary[key]) return dictionary[key];
  if (label.startsWith("#")) return label;
  return label;
}
