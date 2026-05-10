"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomizableWidgetProps {
  /** Widget id, ami a sortable kulcs is. */
  id: string;
  /** A renderelt widget tartalom (a self-fetching komponens). */
  children: React.ReactNode;
  /** Lg-grid span — itt csak class-on keresztül adjuk át. */
  className?: string;
  /** Aktív customize mód? */
  customizing: boolean;
  /** Mobil módban a drag helyett up/down-nyilakat mutatunk. */
  isMobile: boolean;
  /** Az "elrejtés" gombhoz. */
  onHide: () => void;
  /** Mobil sorrendezéshez. */
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** A kettős nyíl letiltása ha első/utolsó. */
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * F30.3 + F30.4 + F30.5 — egy widget köré húzott customize-burok.
 *
 * Két kulcs viselkedés:
 *  - Customize módban a teljes kártya inaktiválva (pointer-events-none),
 *    egy gradient overlay tudatosítja a "szerkesztés alatt" állapotot,
 *    és a tetejére egy chrome-sor kerül (drag handle / hide / move-up-down).
 *  - Default módban a komponens egyszerű passthrough — nincs render
 *    overhead, nincs felesleges DOM, csak a `<li>` és a children.
 *
 * Desktop: a drag handle aktiválja a dnd-kit listenereket, így a kártya
 * teste továbbra is scrollozható ujjal.
 * Mobil: helyett up/down nyilak — egyszerűbb tap-flow long-press dnd-nél.
 */
export function CustomizableWidget({
  id,
  children,
  className,
  customizing,
  isMobile,
  onHide,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: CustomizableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !customizing || isMobile });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative list-none",
        className,
        // Drag-active feedback: emelt árnyék + kissé átlátszó.
        isDragging && "z-50 opacity-80 [&>*]:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]",
      )}
      data-customizing={customizing ? "true" : undefined}
    >
      {/* Customize chrome — csak customize módban renderel. */}
      {customizing && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-20",
            "rounded-[var(--radius-lg,1.25rem)]",
            "ring-2 ring-[var(--accent-gold)]/40 ring-offset-2 ring-offset-[var(--bg-primary,#0A0E1A)]",
            // pulzáló dashed border feeling — háttér nélkül, hogy ne takarja az
            // alatta lévő widgetet.
            "transition-all duration-300",
          )}
          aria-hidden
        />
      )}

      {/* Top action bar — csak customize módban renderel. */}
      {customizing && (
        <div className="absolute -top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
          {/* Drag handle (desktop) vagy mozgató gombok (mobile) */}
          {isMobile ? (
            <div className="pointer-events-auto flex items-center gap-1">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                aria-label="Mozgatás felfelé"
                className={cn(
                  "glass-card inline-flex h-7 w-7 items-center justify-center rounded-full",
                  "border border-[var(--glass-border)] text-[var(--text-secondary)]",
                  "transition-colors hover:text-[var(--accent-gold)]",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-label="Mozgatás lefelé"
                className={cn(
                  "glass-card inline-flex h-7 w-7 items-center justify-center rounded-full",
                  "border border-[var(--glass-border)] text-[var(--text-secondary)]",
                  "transition-colors hover:text-[var(--accent-gold)]",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <ChevronDown size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label="Húzás a sorrendezéshez"
              className={cn(
                "glass-card pointer-events-auto inline-flex h-7 items-center gap-1.5 rounded-full px-2.5",
                "border border-[var(--glass-border)] text-[var(--text-secondary)]",
                "cursor-grab active:cursor-grabbing",
                "font-display text-[10px] uppercase tracking-[0.28em]",
                "transition-colors hover:text-[var(--accent-gold)]",
                "touch-none",
              )}
            >
              <GripVertical size={12} aria-hidden />
              <span>Húzd</span>
            </button>
          )}

          {/* Hide gomb */}
          <button
            type="button"
            onClick={onHide}
            aria-label="Widget elrejtése"
            className={cn(
              "glass-card pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full",
              "border border-[var(--accent-red)]/50 text-[var(--accent-red)]",
              "transition-colors hover:bg-[var(--accent-red)]/15",
            )}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* A widget tartalma. Customize módban a tartalmi pointer-events-et
          kikapcsoljuk — a kártyát ne lehessen kattintással követni amíg
          a felhasználó épp a layout-ot rendezi át. */}
      <div
        className={cn(
          "h-full transition-opacity",
          customizing && "pointer-events-none opacity-90",
        )}
      >
        {children}
      </div>
    </li>
  );
}
