"use client";

import { motion } from "framer-motion";
import { CommunityFeed } from "@/components/social/CommunityFeed";
import { CommunityLeftRail } from "@/components/social/CommunityLeftRail";
import { CommunityRightRail } from "@/components/social/CommunityRightRail";
import { cn } from "@/lib/utils";

/**
 * /kozosseg — F23 community shell.
 *
 * Layout:
 *   - Desktop (≥1024px): 3-column grid — left nav rail (240px) + feed
 *     (flex-1, max 600px) + right widgets rail (280px). The page-level
 *     container caps total width at 1180px so the rails sit close to
 *     the feed instead of drifting on ultra-wide screens.
 *   - Tablet (768–1023px): rails are hidden; only the feed renders.
 *     The "Üzenetek" link still lives in the bottom tab bar / mobile
 *     nav, so collapsing the left rail doesn't trap the user.
 *   - Mobile (<768px): same as tablet — single column, feed-only.
 *
 * The feed itself is unchanged from F11; this file is a frame.
 */
export default function CommunityShellPage() {
  return (
    <div className="relative mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-10">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mb-6 sm:mb-10"
      >
        <p className="font-display text-xs uppercase tracking-[0.4em] text-[var(--accent-gold)]">
          Forca Barça // Közösség
        </p>
        <h1
          className={cn(
            "mt-3 font-display leading-none tracking-wider",
            "text-[var(--text-primary)]",
            "text-4xl sm:text-6xl",
          )}
        >
          A szurkolói tér
        </h1>
        <p className="mt-3 max-w-[40rem] text-sm text-[var(--text-secondary)]">
          A klub hivatalos posztjai, friss reakciókkal és a többi szurkoló
          gondolataival. A feed{" "}
          <span className="text-[var(--accent-gold)]">3 másodpercenként</span>{" "}
          önállóan frissül — a gördítésed nem fog megzökkenni.
        </p>
      </motion.header>

      <div className="flex items-start gap-8">
        <CommunityLeftRail active="feed" />

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[600px]">
            <CommunityFeed />
          </div>
        </main>

        <CommunityRightRail />
      </div>
    </div>
  );
}
