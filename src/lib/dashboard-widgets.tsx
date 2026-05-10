/**
 * Frontend dashboard widget regiszter — F30.1.
 *
 * A `src/lib/constants/dashboard-widgets.ts` (BE 26) konstansa a backend és a
 * frontend közös szerződése: ez tartja a widget id-ket, alapértelmezett
 * láthatóságot és sorrendet. Itt a frontend-specifikus mezőket fűzzük hozzá
 * (ember-olvasható label, ikon, render-komponens, grid span), hogy a
 * `/dashboard` oldal egy adat-vezérelt loop-ban tudja kiválogatni és
 * sorba rendezni a widgeteket a felhasználó mentett konfigurációja alapján.
 *
 * Új widget felvétele:
 *   1. `dashboard-widgets.ts` (BE) — id, defaultVisible, defaultOrder.
 *   2. Wrapper komponens a `components/dashboard/widgets/` alá — saját
 *      maga futtatja a fetch-et és kezeli a saját skeleton/error állapotait.
 *   3. Egy sor ebbe a regiszterbe.
 */

import type { ComponentType, ReactNode } from "react";
import {
  Bell,
  Coins,
  Goal,
  Newspaper,
  Package,
  ShoppingBag,
  Trophy,
  Vote,
  type LucideIcon,
} from "lucide-react";
import {
  DASHBOARD_WIDGETS as BACKEND_CATALOG,
  type DashboardWidgetId,
  type WidgetConfigEntry,
} from "@/lib/constants/dashboard-widgets";
import { NextMatchSelfWidget } from "@/components/dashboard/widgets/NextMatchSelfWidget";
import { LatestNewsSelfWidget } from "@/components/dashboard/widgets/LatestNewsSelfWidget";
import { PointsSelfWidget } from "@/components/dashboard/widgets/PointsSelfWidget";
import { OrdersSelfWidget } from "@/components/dashboard/widgets/OrdersSelfWidget";
import { ActivePollSelfWidget } from "@/components/dashboard/widgets/ActivePollSelfWidget";
import { StandingsWidget } from "@/components/dashboard/StandingsWidget";
import { TopScorersWidget } from "@/components/dashboard/TopScorersWidget";
import { RecommendedProductsWidget } from "@/components/dashboard/RecommendedProductsWidget";

export type { DashboardWidgetId, WidgetConfigEntry };

/** A self-fetch widgetek közös prop-ja. */
export interface DashboardWidgetProps {
  index?: number;
  className?: string;
}

/** Egy frontend widget bejegyzés. */
export interface DashboardWidgetDef {
  id: DashboardWidgetId;
  /** Magyar címke a customize panelhez. */
  label: string;
  /** Rövid másodlagos leírás a rejtett-widget panelhez. */
  description: string;
  /** Lucide ikon a customize listához. */
  icon: LucideIcon;
  /** Alapból látható? */
  defaultVisible: boolean;
  /** Backend default sorrend. */
  defaultOrder: number;
  /**
   * 1 = féloszlop (lg-n 6 col), 2 = teljes szélesség (lg-n 12 col).
   * Egyszerűsített modell az eredeti 8/4 helyett — a customize rendszerben
   * a felhasználó dinamikusan rendezi át a sort, így a gridnek uniformnak
   * kell lennie hogy ne legyen csonka sor.
   */
  gridSpan: 1 | 2;
  /** A self-fetching render komponens. */
  component: ComponentType<DashboardWidgetProps>;
}

// ---------------------------------------------------------------------------
// A regiszter
// ---------------------------------------------------------------------------

export const DASHBOARD_WIDGET_REGISTRY: Record<
  DashboardWidgetId,
  DashboardWidgetDef
> = {
  next_match: {
    id: "next_match",
    label: "Következő meccs",
    description: "Visszaszámláló a soron következő FCB mérkőzésre",
    icon: Bell,
    defaultVisible: true,
    defaultOrder: 0,
    gridSpan: 2,
    component: NextMatchSelfWidget,
  },
  latest_news: {
    id: "latest_news",
    label: "Legújabb hírek",
    description: "A három legfrissebb cikk a hírfolyamból",
    icon: Newspaper,
    defaultVisible: true,
    defaultOrder: 1,
    gridSpan: 1,
    component: LatestNewsSelfWidget,
  },
  points_balance: {
    id: "points_balance",
    label: "Pontegyenleg",
    description: "Az aktuális egyenleged és a legutóbbi tranzakció",
    icon: Coins,
    defaultVisible: true,
    defaultOrder: 2,
    gridSpan: 1,
    component: PointsSelfWidget,
  },
  orders: {
    id: "orders",
    label: "Rendelések",
    description: "A futó rendeléseid áttekintése",
    icon: ShoppingBag,
    defaultVisible: true,
    defaultOrder: 3,
    gridSpan: 1,
    component: OrdersSelfWidget,
  },
  standings: {
    id: "standings",
    label: "Tabella",
    description: "La Liga állás — aktuális Top 5",
    icon: Trophy,
    defaultVisible: true,
    defaultOrder: 4,
    gridSpan: 1,
    component: StandingsWidget,
  },
  top_scorers: {
    id: "top_scorers",
    label: "Top gólszerzők",
    description: "La Liga góllövőlista — Top 5",
    icon: Goal,
    defaultVisible: true,
    defaultOrder: 5,
    gridSpan: 1,
    component: TopScorersWidget,
  },
  active_polls: {
    id: "active_polls",
    label: "Szavazások",
    description: "Aktív közönségszavazás — szavazz pontokért",
    icon: Vote,
    defaultVisible: false,
    defaultOrder: 6,
    gridSpan: 2,
    component: ActivePollSelfWidget,
  },
  recommended_products: {
    id: "recommended_products",
    label: "Ajánlott termékek",
    description: "Személyre szabott termék-ajánlatok a webshopból",
    icon: Package,
    defaultVisible: false,
    defaultOrder: 7,
    gridSpan: 1,
    component: RecommendedProductsWidget,
  },
};

/** Lista-formában is — sorrend a backend katalógus alapján. */
export const DASHBOARD_WIDGET_LIST: ReadonlyArray<DashboardWidgetDef> =
  BACKEND_CATALOG.map((entry) => DASHBOARD_WIDGET_REGISTRY[entry.id]);

/** Default widget config a fronton — mirror a `buildDefaultWidgetConfig`-nek. */
export function buildDefaultWidgetConfigClient(): WidgetConfigEntry[] {
  return BACKEND_CATALOG.map((w) => ({
    widget_id: w.id,
    visible: w.defaultVisible,
    order: w.defaultOrder,
  }));
}

/** Visszaadja a widget definíciót id alapján — null ha ismeretlen. */
export function getWidgetDef(
  id: DashboardWidgetId,
): DashboardWidgetDef | null {
  return DASHBOARD_WIDGET_REGISTRY[id] ?? null;
}

/**
 * Helper render — a widget id és a props alapján a megfelelő komponenst
 * rendereli. A customize-rendszer használja ezt egyetlen helyen.
 */
export function renderWidget(
  id: DashboardWidgetId,
  props: DashboardWidgetProps,
): ReactNode {
  const def = getWidgetDef(id);
  if (!def) return null;
  const Component = def.component;
  return <Component {...props} />;
}
