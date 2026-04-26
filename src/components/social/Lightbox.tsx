"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Full-viewport image lightbox (F11.5).
 *
 * Renders into document.body via a portal so any ancestor `overflow:
 * hidden` (e.g. the feed column) can't clip it. Closes on:
 *   - clicking the backdrop
 *   - clicking the X button
 *   - pressing Escape
 *
 * While open we also lock body scroll — otherwise the background
 * timeline keeps moving under the user's finger on mobile, which is
 * jarring against a stationary image.
 */
interface LightboxProps {
  src: string | null;
  alt: string;
  onClose: () => void;
}

export function Lightbox({ src, alt, onClose }: LightboxProps) {
  const isOpen = src !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && src && (
        <motion.div
          key="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          // Backdrop dismiss: any click on the wrapper itself closes.
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Kép nagyításban"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Bezárás"
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-lg backdrop-blur-md transition hover:bg-white/20 sm:right-6 sm:top-6"
          >
            <X size={20} aria-hidden />
          </button>

          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            // Stop propagation so clicking the IMAGE doesn't close the
            // lightbox — only the backdrop should do that.
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[92vh] max-w-[92vw]"
          >
            <Image
              src={src}
              alt={alt}
              width={1600}
              height={1200}
              sizes="92vw"
              className="h-auto max-h-[92vh] w-auto max-w-[92vw] rounded-lg object-contain shadow-[0_20px_80px_rgba(0,0,0,0.6)]"
              priority
              unoptimized
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
