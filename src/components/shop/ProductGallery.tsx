"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import type { ProductImagePublic } from "@/lib/shop-api";
import { cn } from "@/lib/utils";

/**
 * F32 — Product gallery with thumbnail rail, fade transitions, swipe gesture
 * support and a fullscreen lightbox.
 *
 * Backward compatibility: `images` may be empty (legacy single-image
 * products). When that happens we synthesise a one-entry gallery from
 * `fallbackUrl` so the component renders identically to the previous static
 * `<Image>` block. With a single image the thumbnail rail and the
 * prev/next arrows are hidden — only the main frame + (optional) fullscreen
 * affordance remain.
 *
 * Interaction model:
 *  - Click / tap main frame → opens lightbox (rendered in a `createPortal`
 *    to `document.body` so it escapes the page's stacking context)
 *  - Hover (desktop) reveals prev/next arrows; on touch they're permanent
 *  - Drag horizontally on the main frame to swipe between images
 *  - Lightbox: Escape / backdrop / × button to close; arrow keys to step
 *
 * Performance:
 *  - Only the active main image is `priority` — others are `loading="lazy"`
 *  - Inside the lightbox we serve a higher-quality variant (q=90) of the
 *    active image; thumbnails stay at the default quality
 */

interface ProductGalleryProps {
  images: ProductImagePublic[] | undefined | null;
  /** Cover URL fallback for products that pre-date the gallery feature. */
  fallbackUrl?: string | null;
  alt: string;
  /** Optional decorative slot rendered absolutely over the main frame. */
  overlay?: React.ReactNode;
  className?: string;
}

interface NormalizedImage {
  id: string;
  url: string;
}

const SWIPE_THRESHOLD = 60; // px — beyond this we trigger a step
const SWIPE_VELOCITY = 500; // px/s — also triggers a step (fast flick)

export function ProductGallery({
  images,
  fallbackUrl,
  alt,
  overlay,
  className,
}: ProductGalleryProps) {
  // Normalise the data: if the product has no gallery rows, fall back to
  // the single cover URL. If even that is missing we render a placeholder
  // tile.
  const slides = useMemo<NormalizedImage[]>(() => {
    if (images && images.length > 0) {
      return images.map((img) => ({ id: img.id, url: img.image_url }));
    }
    if (fallbackUrl) {
      return [{ id: "cover", url: fallbackUrl }];
    }
    return [];
  }, [images, fallbackUrl]);

  const hasMultiple = slides.length > 1;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Direction drives Framer's `custom` so the next slide enters from the
  // correct side. State (not a ref) because Framer reads it during the
  // render that AnimatePresence keys off.
  const [direction, setDirection] = useState<1 | -1>(1);

  // If the gallery shrinks (e.g. admin deletes the active image while the
  // page is open), clamp the active index so we never paint an empty slot.
  useEffect(() => {
    if (activeIndex >= slides.length && slides.length > 0) {
      queueMicrotask(() => setActiveIndex(0));
    }
  }, [slides.length, activeIndex]);

  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      const total = slides.length;
      const wrapped = ((next % total) + total) % total;
      setActiveIndex((current) => {
        setDirection(wrapped > current ? 1 : -1);
        return wrapped;
      });
    },
    [slides.length],
  );

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const prev = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  const handleDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (!hasMultiple) return;
      const { offset, velocity } = info;
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY) {
        next();
      } else if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) {
        prev();
      }
    },
    [hasMultiple, next, prev],
  );

  // ---- Empty state ------------------------------------------------------
  if (slides.length === 0) {
    return (
      <div
        className={cn(
          "glass-card relative aspect-[4/5] overflow-hidden",
          "bg-[var(--bg-secondary)] flex items-center justify-center",
          className,
        )}
      >
        <span className="font-display text-6xl tracking-wider text-[var(--text-muted)] opacity-40">
          FCB
        </span>
        {overlay}
      </div>
    );
  }

  const active = slides[activeIndex];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* ---- Main frame ---- */}
      <div
        className={cn(
          "group glass-card relative aspect-[4/5] overflow-hidden",
          "bg-[var(--bg-secondary)] select-none",
        )}
      >
        <AnimatePresence
          initial={false}
          mode="wait"
          custom={direction}
        >
          <motion.div
            key={active.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            drag={hasMultiple ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
            role="button"
            tabIndex={0}
            aria-label={`${alt} — kép ${activeIndex + 1} / ${slides.length}, kattints a nagyításhoz`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setLightboxOpen(true);
              }
            }}
          >
            <Image
              src={active.url}
              alt={alt}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover pointer-events-none"
              draggable={false}
            />
          </motion.div>
        </AnimatePresence>

        {/* Overlay slot (e.g. SaleBadge in the corner) */}
        {overlay}

        {/* Fullscreen affordance — top-right; only shown when there's
            something worth zooming, i.e. always except in pure-empty
            placeholders. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxOpen(true);
          }}
          aria-label="Teljes méretű nézet"
          className={cn(
            "absolute top-3 right-3 z-10",
            "flex h-9 w-9 items-center justify-center rounded-full",
            "bg-black/40 text-white backdrop-blur-md",
            "border border-white/15",
            "transition-all duration-200",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            "hover:bg-black/60",
          )}
        >
          <Maximize2 size={15} strokeWidth={2.2} />
        </button>

        {/* Prev / Next arrows. Hidden on single-image products. On hover
            (desktop) they slide in; on touch (mobile) they stay visible
            via the `(hover: none)` clause. */}
        {hasMultiple && (
          <>
            <ArrowButton
              direction="prev"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              ariaLabel="Előző kép"
            />
            <ArrowButton
              direction="next"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              ariaLabel="Következő kép"
            />
          </>
        )}

        {/* Slide counter (bottom-left). Helps shoppers gauge how many more
            angles they can explore. */}
        {hasMultiple && (
          <div
            className={cn(
              "absolute bottom-3 left-3 z-10",
              "flex items-center gap-1 rounded-full px-3 py-1",
              "bg-black/45 text-[11px] font-medium tracking-[0.18em] text-white",
              "backdrop-blur-md border border-white/10",
            )}
          >
            <span className="font-display">{activeIndex + 1}</span>
            <span className="text-white/60">/</span>
            <span>{slides.length}</span>
          </div>
        )}
      </div>

      {/* ---- Thumbnail rail ----
          Hidden when there's only a single image. Horizontally scrollable
          if it overflows; the active thumb gets a gold ring + brightness
          boost so it's unmistakable. */}
      {hasMultiple && (
        <div
          className={cn(
            "flex gap-2 overflow-x-auto pb-1",
            "scrollbar-thin scrollbar-track-transparent",
            "[scrollbar-width:thin]",
          )}
          aria-label="Termékkép-választó"
          role="tablist"
        >
          {slides.map((slide, idx) => {
            const isActive = idx === activeIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(idx)}
                role="tab"
                aria-selected={isActive}
                aria-label={`${idx + 1}. kép`}
                className={cn(
                  "relative flex-shrink-0 overflow-hidden",
                  "h-20 w-16 sm:h-24 sm:w-20",
                  "rounded-md transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-[var(--accent-gold)]",
                  isActive
                    ? "ring-2 ring-[var(--accent-gold)] shadow-[0_0_18px_-2px_rgba(196,163,77,0.55)]"
                    : "ring-1 ring-[var(--glass-border)] opacity-65 hover:opacity-100",
                )}
              >
                <Image
                  src={slide.url}
                  alt=""
                  fill
                  sizes="80px"
                  loading="lazy"
                  className={cn(
                    "object-cover transition-transform duration-300",
                    isActive ? "scale-105" : "",
                  )}
                  draggable={false}
                />
                {/* Inner gold overlay on the active tile */}
                {isActive && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[var(--accent-gold)]/10 to-transparent"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ---- Lightbox ---- */}
      <Lightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        slides={slides}
        activeIndex={activeIndex}
        onStep={goTo}
        alt={alt}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArrowButton — circular nav button overlaid on the main frame
// ---------------------------------------------------------------------------

interface ArrowButtonProps {
  direction: "prev" | "next";
  onClick: (e: React.MouseEvent) => void;
  ariaLabel: string;
}

function ArrowButton({ direction, onClick, ariaLabel }: ArrowButtonProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 z-10",
        direction === "prev" ? "left-3" : "right-3",
        "flex h-11 w-11 items-center justify-center rounded-full",
        "bg-black/45 text-white backdrop-blur-md",
        "border border-white/15",
        "transition-all duration-200",
        "hover:bg-black/65 hover:scale-105 active:scale-95",
        // Reveal-on-hover on devices that have a real hover state, always
        // visible on touch screens.
        "@media (hover: hover) { opacity: 0; }",
        "[@media(hover:hover)]:opacity-0",
        "[@media(hover:hover)]:group-hover:opacity-100",
        "focus-visible:opacity-100",
      )}
    >
      <Icon size={20} strokeWidth={2.2} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lightbox — fullscreen viewer rendered through createPortal
// ---------------------------------------------------------------------------

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  slides: NormalizedImage[];
  activeIndex: number;
  onStep: (next: number) => void;
  alt: string;
}

function Lightbox({
  open,
  onClose,
  slides,
  activeIndex,
  onStep,
  alt,
}: LightboxProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // Direction tracker for the inner AnimatePresence — used here only for
  // future variant support; the current implementation does a simple
  // scale fade so we just call setter to keep React linter happy.
  const [, setLightboxDirection] = useState<1 | -1>(1);

  // Lock body scroll while open. We intentionally use `document.body.style`
  // and restore on cleanup — covers both close and unmount.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Keyboard navigation: Escape, ArrowLeft, ArrowRight
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" && slides.length > 1) {
        setLightboxDirection(1);
        onStep(activeIndex + 1);
      } else if (e.key === "ArrowLeft" && slides.length > 1) {
        setLightboxDirection(-1);
        onStep(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, onStep, activeIndex, slides.length]);

  const handleDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      if (slides.length < 2) return;
      const { offset, velocity } = info;
      if (offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY) {
        setLightboxDirection(1);
        onStep(activeIndex + 1);
      } else if (offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY) {
        setLightboxDirection(-1);
        onStep(activeIndex - 1);
      }
    },
    [activeIndex, onStep, slides.length],
  );

  if (!mounted || typeof document === "undefined") return null;
  if (slides.length === 0) return null;

  const active = slides[activeIndex];
  const hasMultiple = slides.length > 1;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Termékképek nagyobb méretben"
        >
          {/* Backdrop — much darker than the standard glass-modal-backdrop
              so the photos read crisp against it. Click anywhere outside
              the image closes the lightbox. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Bezárás"
            className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-zoom-out"
          />

          {/* Top bar — counter + close button */}
          <div className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
            <div
              className={cn(
                "rounded-full px-4 py-1.5 text-xs tracking-[0.18em]",
                "bg-white/8 text-white border border-white/10 backdrop-blur-md",
                "font-display uppercase",
              )}
            >
              {activeIndex + 1} / {slides.length}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Bezárás"
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full",
                "bg-white/10 text-white border border-white/15",
                "backdrop-blur-md transition-all duration-200",
                "hover:bg-white/20 hover:scale-105 active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2",
                "focus-visible:ring-[var(--accent-gold)]",
              )}
            >
              <X size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* Main image area */}
          <div className="relative z-10 flex flex-1 items-center justify-center px-4 sm:px-12">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                drag={hasMultiple ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={handleDragEnd}
                className="relative h-full w-full max-w-5xl select-none"
              >
                <Image
                  src={active.url}
                  alt={alt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 1024px, 100vw"
                  quality={92}
                  className="object-contain pointer-events-none"
                  draggable={false}
                />
              </motion.div>
            </AnimatePresence>

            {hasMultiple && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxDirection(-1);
                    onStep(activeIndex - 1);
                  }}
                  aria-label="Előző kép"
                  className={cn(
                    "absolute left-2 sm:left-6 top-1/2 -translate-y-1/2",
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    "bg-white/10 text-white border border-white/15",
                    "backdrop-blur-md transition-all duration-200",
                    "hover:bg-white/20 hover:scale-105 active:scale-95",
                  )}
                >
                  <ChevronLeft size={22} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxDirection(1);
                    onStep(activeIndex + 1);
                  }}
                  aria-label="Következő kép"
                  className={cn(
                    "absolute right-2 sm:right-6 top-1/2 -translate-y-1/2",
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    "bg-white/10 text-white border border-white/15",
                    "backdrop-blur-md transition-all duration-200",
                    "hover:bg-white/20 hover:scale-105 active:scale-95",
                  )}
                >
                  <ChevronRight size={22} strokeWidth={2.4} />
                </button>
              </>
            )}
          </div>

          {/* Bottom thumbnail strip */}
          {hasMultiple && (
            <div className="relative z-10 px-4 pb-5 pt-3 sm:px-8">
              <div
                className={cn(
                  "mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-1",
                  "[scrollbar-width:thin]",
                )}
              >
                {slides.map((slide, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => {
                        setLightboxDirection(idx > activeIndex ? 1 : -1);
                        onStep(idx);
                      }}
                      aria-label={`${idx + 1}. kép`}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "relative h-16 w-14 flex-shrink-0 overflow-hidden rounded",
                        "transition-all duration-200",
                        isActive
                          ? "ring-2 ring-[var(--accent-gold)] opacity-100 scale-[1.04]"
                          : "ring-1 ring-white/15 opacity-55 hover:opacity-90",
                      )}
                    >
                      <Image
                        src={slide.url}
                        alt=""
                        fill
                        sizes="56px"
                        loading="lazy"
                        className="object-cover"
                        draggable={false}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ---------------------------------------------------------------------------
// Slide variants — direction-aware enter/exit so the next image enters from
// the correct side of the frame.
// ---------------------------------------------------------------------------

const slideVariants = {
  enter: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction > 0 ? 32 : -32,
  }),
  center: { opacity: 1, x: 0 },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    x: direction > 0 ? -32 : 32,
  }),
};
