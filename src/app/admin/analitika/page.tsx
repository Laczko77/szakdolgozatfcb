"use client";

/**
 * F15.11 — Admin analitika dashboard.
 *
 * - GET /api/admin/analytics/overview  → KPI kártyák
 * - GET /api/admin/analytics/pages     → top 20 oldal (BarChart)
 * - GET /api/admin/analytics/products  → top 20 termék (BarChart)
 *
 * Recharts horizontal BarChart-okat használunk ResponsiveContainer-rel.
 * A színek a project admin token rendszeréhez igazodnak (--accent-gold,
 * --glass-border, --text-primary, stb.).
 */

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CircleDollarSign,
  Eye,
  ShoppingBag,
  Users,
  Vote,
} from "lucide-react";

import {
  AdminCard,
  AdminCardBody,
  AdminCardHeader,
  AdminCardTitle,
} from "@/components/admin/AdminCard";
import { adminFetch } from "@/lib/admin-fetch";

interface Overview {
  total_users: number;
  total_orders: number;
  total_revenue: number;
  active_polls: number;
  total_page_views: number;
  total_consents: number;
}

interface PageRow {
  page_path: string;
  view_count: number;
  last_viewed_at: string | null;
}

interface ProductRow {
  product_id: string;
  name: string;
  image_url: string | null;
  price: number;
  category: string | null;
  view_count: number;
  last_viewed_at: string | null;
}

const numberFormatter = new Intl.NumberFormat("hu-HU");
const currencyFormatter = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminAnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewData, pagesData, productsData] = await Promise.all([
          adminFetch<Overview>("/api/admin/analytics/overview", {
            signal: ac.signal,
            cache: "no-store",
          }),
          adminFetch<{ pages: PageRow[] }>(
            "/api/admin/analytics/pages?limit=20",
            { signal: ac.signal, cache: "no-store" },
          ),
          adminFetch<{ products: ProductRow[] }>(
            "/api/admin/analytics/products?limit=20",
            { signal: ac.signal, cache: "no-store" },
          ),
        ]);
        if (ac.signal.aborted) return;
        setOverview(overviewData);
        setPages(pagesData.pages ?? []);
        setProducts(productsData.products ?? []);
      } catch (err) {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Ismeretlen hiba");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    };
    queueMicrotask(() => {
      void run();
    });
    return () => ac.abort();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl uppercase tracking-[0.06em] text-[var(--text-primary)]">
          Analitika
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Összegzés a felhasználói aktivitásról és a webshop teljesítményéről.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 px-4 py-2 text-sm text-[var(--accent-red)]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-[var(--text-muted)]">
          Betöltés…
        </p>
      ) : (
        <>
          <KpiGrid overview={overview} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AdminCard>
              <AdminCardHeader>
                <div>
                  <AdminCardTitle>Legnézettebb oldalak</AdminCardTitle>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Top 20 oldalmegtekintés száma alapján.
                  </p>
                </div>
              </AdminCardHeader>
              <AdminCardBody>
                {pages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                    Még nincs adat.
                  </p>
                ) : (
                  <PagesChart rows={pages} />
                )}
              </AdminCardBody>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader>
                <div>
                  <AdminCardTitle>Legnézettebb termékek</AdminCardTitle>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Top 20 termékmegtekintés száma alapján.
                  </p>
                </div>
              </AdminCardHeader>
              <AdminCardBody>
                {products.length === 0 ? (
                  <p className="py-8 text-center text-sm text-[var(--text-muted)]">
                    Még nincs adat.
                  </p>
                ) : (
                  <ProductsChart rows={products} />
                )}
              </AdminCardBody>
            </AdminCard>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI cards
// ---------------------------------------------------------------------------

function KpiGrid({ overview }: { overview: Overview | null }) {
  if (!overview) return null;
  const cards: Array<{
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
    sub?: string;
  }> = [
    {
      label: "Felhasználók",
      value: numberFormatter.format(overview.total_users),
      icon: Users,
      sub: `${numberFormatter.format(overview.total_consents)} cookie consent`,
    },
    {
      label: "Rendelések",
      value: numberFormatter.format(overview.total_orders),
      icon: ShoppingBag,
    },
    {
      label: "Bevétel",
      value: currencyFormatter.format(overview.total_revenue),
      icon: CircleDollarSign,
    },
    {
      label: "Aktív szavazások",
      value: numberFormatter.format(overview.active_polls),
      icon: Vote,
    },
    {
      label: "Oldalmegtekintések",
      value: numberFormatter.format(overview.total_page_views),
      icon: Eye,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map(({ label, value, icon: Icon, sub }) => (
        <AdminCard key={label}>
          <AdminCardBody className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                {label}
              </span>
              <Icon className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
            <div className="font-display text-2xl tracking-tight tabular-nums text-[var(--text-primary)]">
              {value}
            </div>
            {sub ? (
              <p className="text-xs text-[var(--text-muted)]">{sub}</p>
            ) : null}
          </AdminCardBody>
        </AdminCard>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

const BAR_COLOR = "var(--accent-gold)";
const GRID_COLOR = "var(--glass-border)";
const AXIS_TEXT = "var(--text-muted)";
const AXIS_LABEL = "var(--text-primary)";

interface ChartTooltipPayload {
  payload?: { fullLabel?: string };
  value?: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const fullLabel = entry?.payload?.fullLabel ?? label;
  return (
    <div className="rounded-md border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs shadow-lg">
      <div className="font-medium text-[var(--text-primary)]">{fullLabel}</div>
      <div className="text-[var(--text-secondary)]">
        {numberFormatter.format(entry?.value ?? 0)} megtekintés
      </div>
    </div>
  );
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

function PagesChart({ rows }: { rows: PageRow[] }) {
  const data = rows.map((r) => ({
    label: truncate(r.page_path || "/", 24),
    fullLabel: r.page_path || "/",
    views: r.view_count,
  }));
  const height = Math.max(280, rows.length * 28);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_COLOR}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: AXIS_TEXT }}
            stroke={GRID_COLOR}
            tickFormatter={(v) => numberFormatter.format(v as number)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tick={{ fontSize: 11, fill: AXIS_LABEL }}
            stroke={GRID_COLOR}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "var(--glass-bg-hover)" }}
          />
          <Bar dataKey="views" radius={[0, 4, 4, 0]}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProductsChart({ rows }: { rows: ProductRow[] }) {
  const data = rows.map((r) => ({
    label: truncate(r.name, 24),
    fullLabel: r.name,
    views: r.view_count,
  }));
  const height = Math.max(280, rows.length * 28);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={GRID_COLOR}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: AXIS_TEXT }}
            stroke={GRID_COLOR}
            tickFormatter={(v) => numberFormatter.format(v as number)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tick={{ fontSize: 11, fill: AXIS_LABEL }}
            stroke={GRID_COLOR}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "var(--glass-bg-hover)" }}
          />
          <Bar dataKey="views" radius={[0, 4, 4, 0]}>
            {data.map((_, idx) => (
              <Cell key={idx} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
