"use client";

import { motion } from "framer-motion";
import { Plus, EyeOff } from "lucide-react";
import {
  DASHBOARD_WIDGET_REGISTRY,
  type DashboardWidgetId,
} from "@/lib/dashboard-widgets";
import { cn } from "@/lib/utils";

interface HiddenWidgetsPanelProps {
  /** A jelenleg rejtett widget-id-k. */
  hiddenIds: DashboardWidgetId[];
  /** "Megjelenítés" gomb — a widget visszakerül a látható lista végére. */
  onShow: (id: DashboardWidgetId) => void;
}

/**
 * F30.5 + F30.8 — a customize-mód alján renderelt panel a rejtett widgetekről.
 *
 * Üres állapot: friendly "minden widget látható" üzenet, hogy a user ne
 * gondolja hogy hibát látunk.
 * Tele állapot: glass-card lista, mindegyik bejegyzés ikon + label +
 * description + "Megjelenítés" CTA-val.
 */
export function HiddenWidgetsPanel({
  hiddenIds,
  onShow,
}: HiddenWidgetsPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className={cn(
        "glass-card mt-8 overflow-hidden p-6 sm:p-7",
        "border-dashed border-[var(--accent-gold)]/30",
      )}
      aria-labelledby="hidden-widgets-heading"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Rejtett widgetek
          </p>
          <h3
            id="hidden-widgets-heading"
            className="mt-1.5 font-display text-xl tracking-wide text-[var(--text-primary)]"
          >
            Hozz vissza a dashboardra
          </h3>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border border-[var(--glass-border)]",
            "bg-[var(--glass-bg)] px-2.5 py-1",
            "font-display text-xs tabular-nums text-[var(--text-secondary)]",
          )}
        >
          {hiddenIds.length}
        </span>
      </header>

      {hiddenIds.length === 0 ? (
        <p
          className={cn(
            "mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]",
          )}
        >
          <EyeOff size={14} aria-hidden />
          Minden widget látható a dashboardon.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {hiddenIds.map((id) => {
            const def = DASHBOARD_WIDGET_REGISTRY[id];
            if (!def) return null;
            const Icon = def.icon;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onShow(id)}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-[var(--radius-md)] p-3 text-left",
                    "border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                    "transition-all duration-200",
                    "hover:border-[var(--accent-gold)]/50 hover:bg-[var(--glass-bg-hover)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      "border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40",
                      "text-[var(--text-secondary)] transition-colors",
                      "group-hover:border-[var(--accent-gold)]/50 group-hover:text-[var(--accent-gold)]",
                    )}
                  >
                    <Icon size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-sm tracking-wide text-[var(--text-primary)]">
                      {def.label}
                    </span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {def.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      "border border-[var(--accent-gold)]/30 text-[var(--accent-gold)]",
                      "transition-transform group-hover:scale-110",
                    )}
                    aria-hidden
                  >
                    <Plus size={13} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
