"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Circular avatar with initial fallback.
 *
 * Used in posts (40px) and comments (32px). The initial is computed
 * from the visible name so anonymous users still show *something*
 * recognisable rather than a bare grey disc.
 */
interface AvatarProps {
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ url, name, size = 40, className }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        "border border-[var(--glass-border)] bg-[var(--glass-bg-strong)]",
        "text-[var(--text-secondary)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {url ? (
        <Image
          src={url}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        <span
          className="font-display tracking-wide"
          style={{ fontSize: Math.round(size * 0.42) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
