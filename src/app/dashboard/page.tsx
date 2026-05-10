"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import {
  DashboardHeroSkeleton,
  WidgetSkeleton,
} from "@/components/dashboard/WidgetSkeleton";
import { QuickLinks } from "@/components/dashboard/QuickLinks";
import { CustomizeToolbar } from "@/components/dashboard/customize/CustomizeToolbar";
import { CustomizableWidget } from "@/components/dashboard/customize/CustomizableWidget";
import { HiddenWidgetsPanel } from "@/components/dashboard/customize/HiddenWidgetsPanel";
import { ResetConfirmModal } from "@/components/dashboard/customize/ResetConfirmModal";
import {
  DASHBOARD_WIDGET_REGISTRY,
  buildDefaultWidgetConfigClient,
  renderWidget,
  type DashboardWidgetId,
} from "@/lib/dashboard-widgets";
import {
  fetchDashboardPreferences,
  saveDashboardPreferences,
  resetDashboardPreferences,
  type WidgetConfigEntry,
} from "@/lib/dashboard-preferences-api";
import { cn } from "@/lib/utils";

/**
 * /dashboard — F30: testreszabható dashboard.
 *
 * A felhasználó a `Testreszabás` gombbal beléphet egy szerkesztő-módba, ahol
 *  - drag-and-drop-pal sorrendezhet (desktop) vagy fel/le-nyilakkal (mobil),
 *  - X-szel elrejthet egy widget-et, vagy a "Rejtett widgetek" panelről
 *    visszahozhat,
 *  - Mentés gombra hívja a `PUT /api/dashboard-preferences`-t,
 *  - Mégse gomb visszaállítja a session előtti állapotot,
 *  - "Visszaállítás" gomb (megerősítő modal után) törli a mentést és
 *    visszaadja a default catalogue-konfigurációt.
 *
 * Adatbetöltés:
 *  - Page-szinten csak a widget-config GET-jét hívjuk; a widgetek saját
 *    maguk fetch-elnek, így rejtett widget adatait sosem kérjük le.
 */

interface CustomizeState {
  /** A jelenleg perzisztált / utoljára mentett konfiguráció. */
  saved: WidgetConfigEntry[];
  /** A customize-mód lokális (pre-save) draft-ja. */
  draft: WidgetConfigEntry[];
  /** Customize mód aktív? */
  customizing: boolean;
  /** Megerősítő modal megnyitva? */
  resetConfirmOpen: boolean;
}

function dedupeOrders(entries: WidgetConfigEntry[]): WidgetConfigEntry[] {
  // A backend egyedi (unique) order-eket vár — sortolt, sequenciális
  // 0..N-1 sorrendet írunk ki, hogy ne legyen duplikáció.
  return [...entries]
    .sort((a, b) => a.order - b.order)
    .map((entry, idx) => ({ ...entry, order: idx }));
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

function DashboardContent() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [configLoaded, setConfigLoaded] = useState(false);
  const [config, setConfig] = useState<CustomizeState>({
    saved: buildDefaultWidgetConfigClient(),
    draft: buildDefaultWidgetConfigClient(),
    customizing: false,
    resetConfirmOpen: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // ───────── load preferences ─────────
  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardPreferences(controller.signal)
      .then((res) => {
        const normalized = dedupeOrders(res.widget_config);
        setConfig((prev) => ({
          ...prev,
          saved: normalized,
          draft: normalized,
        }));
        setConfigLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Visszaesés a default-ra ha a backend hibát ad — nem akarjuk üresen
        // hagyni a dashboard-ot.
        const fallback = buildDefaultWidgetConfigClient();
        setConfig((prev) => ({
          ...prev,
          saved: fallback,
          draft: fallback,
        }));
        setConfigLoaded(true);
        toast.error(
          err instanceof Error
            ? err.message
            : "Dashboard beállítások betöltése sikertelen",
        );
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ───────── derived view models ─────────
  /** Sortolt, csak látható widgetek a draftból (customize módban) vagy savedból. */
  const activeConfig = config.customizing ? config.draft : config.saved;
  const visibleEntries = useMemo(
    () =>
      [...activeConfig]
        .filter((e) => e.visible && DASHBOARD_WIDGET_REGISTRY[e.widget_id])
        .sort((a, b) => a.order - b.order),
    [activeConfig],
  );
  const hiddenIds = useMemo(
    () =>
      [...activeConfig]
        .filter((e) => !e.visible && DASHBOARD_WIDGET_REGISTRY[e.widget_id])
        .map((e) => e.widget_id),
    [activeConfig],
  );

  /** Tényleg módosított-e a draft a savedhez képest? */
  const isDirty = useMemo(() => {
    if (config.draft.length !== config.saved.length) return true;
    const savedById = new Map(
      config.saved.map((e) => [e.widget_id, e] as const),
    );
    for (const d of config.draft) {
      const s = savedById.get(d.widget_id);
      if (!s) return true;
      if (s.visible !== d.visible || s.order !== d.order) return true;
    }
    return false;
  }, [config.draft, config.saved]);

  // ───────── customize mode handlers ─────────
  const enterCustomize = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      customizing: true,
      // Friss draft a saved-ből — minden új belépés tiszta lap.
      draft: prev.saved.map((e) => ({ ...e })),
    }));
  }, []);

  const cancelCustomize = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      customizing: false,
      draft: prev.saved.map((e) => ({ ...e })),
    }));
  }, []);

  const hideWidget = useCallback((id: DashboardWidgetId) => {
    setConfig((prev) => ({
      ...prev,
      draft: prev.draft.map((e) =>
        e.widget_id === id ? { ...e, visible: false } : e,
      ),
    }));
  }, []);

  const showWidget = useCallback((id: DashboardWidgetId) => {
    setConfig((prev) => {
      // A láthatóvá tett widget a látható lista végére kerüljön
      // (legmagasabb order + 1).
      const visibleOrders = prev.draft
        .filter((e) => e.visible)
        .map((e) => e.order);
      const nextOrder =
        visibleOrders.length > 0 ? Math.max(...visibleOrders) + 1 : 0;
      const updated = prev.draft.map((e) =>
        e.widget_id === id
          ? { ...e, visible: true, order: nextOrder }
          : e,
      );
      return { ...prev, draft: dedupeOrders(updated) };
    });
  }, []);

  const moveWidget = useCallback(
    (id: DashboardWidgetId, direction: -1 | 1) => {
      setConfig((prev) => {
        const visible = [...prev.draft]
          .filter((e) => e.visible)
          .sort((a, b) => a.order - b.order);
        const idx = visible.findIndex((e) => e.widget_id === id);
        const targetIdx = idx + direction;
        if (idx < 0 || targetIdx < 0 || targetIdx >= visible.length) {
          return prev;
        }
        const reordered = arrayMove(visible, idx, targetIdx);
        // Új sorrend kiosztása a látható elemeknek; a rejtetteket utánuk fűzzük.
        const hidden = prev.draft.filter((e) => !e.visible);
        const merged = [
          ...reordered.map((e, i) => ({ ...e, order: i })),
          ...hidden.map((e, i) => ({ ...e, order: reordered.length + i })),
        ];
        return { ...prev, draft: merged };
      });
    },
    [],
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setConfig((prev) => {
      const visible = [...prev.draft]
        .filter((e) => e.visible)
        .sort((a, b) => a.order - b.order);
      const oldIndex = visible.findIndex((e) => e.widget_id === active.id);
      const newIndex = visible.findIndex((e) => e.widget_id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const reordered = arrayMove(visible, oldIndex, newIndex);
      const hidden = prev.draft.filter((e) => !e.visible);
      const merged = [
        ...reordered.map((e, i) => ({ ...e, order: i })),
        ...hidden.map((e, i) => ({ ...e, order: reordered.length + i })),
      ];
      return { ...prev, draft: merged };
    });
  }, []);

  // ───────── persistence ─────────
  const saveCustomize = useCallback(async () => {
    setIsSaving(true);
    try {
      // A backend egyedi widget_id-t és egyedi order-t vár — dedupeOrders
      // garantálja a 0..N-1 sequencet.
      const payload = dedupeOrders(config.draft);
      const res = await saveDashboardPreferences(payload);
      const normalized = dedupeOrders(res.widget_config);
      setConfig({
        saved: normalized,
        draft: normalized,
        customizing: false,
        resetConfirmOpen: false,
      });
      toast.success("Dashboard testreszabás mentve");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Mentés sikertelen",
      );
    } finally {
      setIsSaving(false);
    }
  }, [config.draft, toast]);

  const requestReset = useCallback(() => {
    setConfig((prev) => ({ ...prev, resetConfirmOpen: true }));
  }, []);

  const cancelReset = useCallback(() => {
    setConfig((prev) => ({ ...prev, resetConfirmOpen: false }));
  }, []);

  const confirmReset = useCallback(async () => {
    setIsResetting(true);
    try {
      const res = await resetDashboardPreferences();
      const normalized = dedupeOrders(res.widget_config);
      setConfig({
        saved: normalized,
        draft: normalized,
        customizing: false,
        resetConfirmOpen: false,
      });
      toast.success("Visszaállítva az alapértelmezett elrendezésre");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Visszaállítás sikertelen",
      );
    } finally {
      setIsResetting(false);
    }
  }, [toast]);

  // ───────── dnd-kit sensors (F27.5 minta) ─────────
  // Ugyanaz a recipe mint a dream-team-ben: külön mouse + touch sensor,
  // touch-ra delay-alapú aktivációval, hogy a függőleges scroll ne
  // ragadja el a drag-et.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  // ───────── render ─────────
  const sortableIds = visibleEntries.map((e) => e.widget_id);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      {/* Hero + toolbar */}
      <div className="flex flex-col gap-4 sm:gap-6">
        {!configLoaded && profile === null ? (
          <DashboardHeroSkeleton />
        ) : (
          <DashboardHero profile={profile} email={user?.email ?? null} />
        )}

        <div className="flex items-center justify-between gap-3">
          <CustomizeBanner customizing={config.customizing} />
          <CustomizeToolbar
            customizing={config.customizing}
            isDirty={isDirty}
            isSaving={isSaving}
            onEnter={enterCustomize}
            onCancel={cancelCustomize}
            onSave={() => void saveCustomize()}
            onResetRequest={requestReset}
          />
        </div>
      </div>

      {/* Widget grid */}
      {!configLoaded ? (
        <div
          className={cn(
            "mt-6 grid gap-5 sm:gap-6 sm:mt-8",
            "grid-cols-1 lg:grid-cols-12",
          )}
        >
          <WidgetSkeleton className="lg:col-span-12" rows={4} />
          <WidgetSkeleton className="lg:col-span-6" rows={3} />
          <WidgetSkeleton className="lg:col-span-6" rows={3} />
          <WidgetSkeleton className="lg:col-span-6" rows={3} />
          <WidgetSkeleton className="lg:col-span-6" rows={3} />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={rectSortingStrategy}>
            <ul
              className={cn(
                "mt-6 grid gap-5 sm:gap-6 sm:mt-8",
                "grid-cols-1 lg:grid-cols-12",
                config.customizing && "pt-4",
              )}
            >
              {visibleEntries.map((entry, idx) => {
                const def = DASHBOARD_WIDGET_REGISTRY[entry.widget_id];
                const span =
                  def.gridSpan === 2 ? "lg:col-span-12" : "lg:col-span-6";
                return (
                  <CustomizableWidget
                    key={entry.widget_id}
                    id={entry.widget_id}
                    className={span}
                    customizing={config.customizing}
                    isMobile={isMobile}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < visibleEntries.length - 1}
                    onMoveUp={() => moveWidget(entry.widget_id, -1)}
                    onMoveDown={() => moveWidget(entry.widget_id, 1)}
                    onHide={() => hideWidget(entry.widget_id)}
                  >
                    {renderWidget(entry.widget_id, { index: idx })}
                  </CustomizableWidget>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* QuickLinks — fix elem, nem konfigurálható (mindig a dashboard alján). */}
      {configLoaded && !config.customizing && visibleEntries.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:gap-6 sm:mt-8 lg:grid-cols-12">
          <QuickLinks
            index={visibleEntries.length}
            className="lg:col-span-12"
          />
        </div>
      )}

      {/* Empty state ha minden el van rejtve. */}
      {configLoaded && visibleEntries.length === 0 && !config.customizing && (
        <EmptyDashboard onEnterCustomize={enterCustomize} />
      )}

      {/* Hidden widgets panel — csak customize módban. */}
      {config.customizing && configLoaded && (
        <HiddenWidgetsPanel hiddenIds={hiddenIds} onShow={showWidget} />
      )}

      {/* Reset confirm modal */}
      <ResetConfirmModal
        open={config.resetConfirmOpen}
        isSubmitting={isResetting}
        onCancel={cancelReset}
        onConfirm={() => void confirmReset()}
      />
    </div>
  );
}

/**
 * Diszkrét banner ami csak customize módban tűnik fel. A felhasználó
 * gyorsan vissza tud jönni a kontextusba ("most épp szerkesztek").
 */
function CustomizeBanner({ customizing }: { customizing: boolean }) {
  if (!customizing) return <span aria-hidden />;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full",
        "border border-[var(--accent-gold)]/40 bg-[var(--accent-gold)]/10",
        "px-3 py-1.5 text-xs",
        "text-[var(--accent-gold)]",
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-gold)]/60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent-gold)]" />
      </span>
      <span className="font-display uppercase tracking-[0.24em]">
        Testreszabás módban
      </span>
    </motion.div>
  );
}

/** Üres állapot ha a felhasználó minden widget-et elrejtett. */
function EmptyDashboard({
  onEnterCustomize,
}: {
  onEnterCustomize: () => void;
}) {
  return (
    <div
      className={cn(
        "glass-card mt-8 flex flex-col items-center gap-3 px-6 py-12 text-center",
      )}
    >
      <p className="font-display text-[11px] uppercase tracking-[0.4em] text-[var(--accent-gold)]">
        Üres dashboard
      </p>
      <h2 className="font-display text-2xl tracking-wide text-[var(--text-primary)]">
        Minden widget el van rejtve
      </h2>
      <p className="max-w-md text-sm text-[var(--text-muted)]">
        A testreszabás módban hozz vissza widgeteket a &bdquo;Rejtett
        widgetek&rdquo; panelről, vagy állítsd vissza az alapértelmezett
        elrendezést.
      </p>
      <button
        type="button"
        onClick={onEnterCustomize}
        className="glass-button-primary mt-2"
      >
        Testreszabás
      </button>
    </div>
  );
}
