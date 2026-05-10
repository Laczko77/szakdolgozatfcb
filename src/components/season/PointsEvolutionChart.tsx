"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  fetchStandingsEvolution,
  FCB_TEAM_ID,
  pickRunnerUp,
  teamPointsSeries,
  type MatchdaySnapshot,
  type StandingsEvolutionResponse,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";
import { ChartShell } from "./ChartShell";
import { ChartZoomModal } from "./ChartZoomModal";
import {
  CacheLabel,
  ChartSkeleton,
  EmptyBlock,
  ErrorBlock,
} from "./primitives";

interface PointsEvolutionChartProps {
  season: number;
  index?: number;
  className?: string;
}

/**
 * "Pont evolúció" — cumulative-points line chart for the season.
 *
 * Renders two series:
 *   1. FC Barcelona (gold + blue gradient) — always shown.
 *   2. The current 2nd-placed team (red) — picked at render time from
 *      the last available matchday snapshot. When FCB themselves are 2nd
 *      we fall back to the league leader so the comparator is always
 *      meaningful.
 *
 * Self-fetches its data so the component is portable (the dashboard or
 * /jegyek could host the same widget without page-level wiring).
 */
export function PointsEvolutionChart({
  season,
  index = 0,
  className,
}: PointsEvolutionChartProps) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<StandingsEvolutionResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    // Reset state via microtask to satisfy `react-hooks/set-state-in-effect`
    // (React 19 + eslint-config-next blocks synchronous setState inside effects).
    queueMicrotask(() => {
      setLoaded(false);
      setErrorMessage(null);
      setData(null);
    });
    const controller = new AbortController();
    fetchStandingsEvolution({ season }, controller.signal)
      .then((res) => {
        setData(res);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "A pont evolúció jelenleg nem elérhető",
        );
        setLoaded(true);
      });
    return () => controller.abort();
  }, [season, retryNonce]);

  const chart = useMemo(() => buildChartData(data?.evolution ?? []), [data]);
  const [zoomOpen, setZoomOpen] = useState(false);
  const hasData = !!chart && chart.rows.length > 0;

  return (
    <>
      <ChartShell
        eyebrow="Pontok evolúciója"
        title="Az FCB szezonjának íve"
        description="Fordulóról fordulóra kumulatív pontszám — a Barça mellett az aktuális második helyezett csapat."
        meta={<CacheLabel cachedAt={data?.cached_at} stale={data?.stale} />}
        index={index}
        className={className}
        zoomable={hasData}
        onZoom={() => setZoomOpen(true)}
      >
        {!loaded ? (
          <ChartSkeleton height={220} />
        ) : errorMessage ? (
          <ErrorBlock
            message={errorMessage}
            onRetry={() => setRetryNonce((n) => n + 1)}
          />
        ) : !chart || chart.rows.length === 0 ? (
          <EmptyBlock message="A szezon még nem kezdődött el — térj vissza az első forduló után." />
        ) : (
          <PointsChartBody
            rows={chart.rows}
            fcbName={chart.fcbName}
            rivalName={chart.rivalName}
            reduced={reduced}
            height="compact"
          />
        )}
      </ChartShell>

      {chart && (
        <ChartZoomModal
          open={zoomOpen}
          onClose={() => setZoomOpen(false)}
          title="Pontok evolúciója"
          subtitle="Fordulóról fordulóra kumulatív pontszám — a Barça mellett az aktuális második helyezett csapat."
        >
          <PointsChartBody
            rows={chart.rows}
            fcbName={chart.fcbName}
            rivalName={chart.rivalName}
            reduced={reduced}
            height="full"
          />
        </ChartZoomModal>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Chart body
// ---------------------------------------------------------------------------

interface ChartRow {
  matchday: number;
  fcb_points: number | null;
  fcb_gd: number | null;
  fcb_pos: number | null;
  rival_points: number | null;
  rival_gd: number | null;
  rival_pos: number | null;
}

interface ChartData {
  rows: ChartRow[];
  fcbName: string;
  rivalName: string | null;
}

function buildChartData(evolution: MatchdaySnapshot[]): ChartData | null {
  if (evolution.length === 0) {
    return { rows: [], fcbName: "FC Barcelona", rivalName: null };
  }
  const fcbSeries = teamPointsSeries(evolution, FCB_TEAM_ID);
  // Resolve a stable rival id from the last snapshot.
  const rival = pickRunnerUp(evolution, FCB_TEAM_ID);
  const rivalSeries = rival
    ? teamPointsSeries(evolution, rival.team_id)
    : [];

  const lastSnap = evolution[evolution.length - 1];
  const fcbName =
    lastSnap.teams.find((t) => t.team_id === FCB_TEAM_ID)?.team_name ??
    "FC Barcelona";

  // Build a unioned matchday axis so both series keep aligned x-positions.
  const matchdays = new Set<number>();
  for (const r of fcbSeries) matchdays.add(r.matchday);
  for (const r of rivalSeries) matchdays.add(r.matchday);

  const rows: ChartRow[] = [...matchdays]
    .sort((a, b) => a - b)
    .map((md) => {
      const fcb = fcbSeries.find((r) => r.matchday === md) ?? null;
      const rv = rivalSeries.find((r) => r.matchday === md) ?? null;
      return {
        matchday: md,
        fcb_points: fcb?.points ?? null,
        fcb_gd: fcb?.goal_difference ?? null,
        fcb_pos: fcb?.position ?? null,
        rival_points: rv?.points ?? null,
        rival_gd: rv?.goal_difference ?? null,
        rival_pos: rv?.position ?? null,
      };
    });

  return {
    rows,
    fcbName,
    rivalName: rival?.team_name ?? null,
  };
}

interface PointsChartBodyProps {
  rows: ChartRow[];
  fcbName: string;
  rivalName: string | null;
  reduced: boolean;
  /** "compact" → small inline (200/240px), "full" → fills the parent (zoom modal). */
  height?: "compact" | "full";
}

function PointsChartBody({
  rows,
  fcbName,
  rivalName,
  reduced,
  height = "compact",
}: PointsChartBodyProps) {
  // In `full` mode (zoom modal) the parent already enforces a 600px-tall box;
  // we stretch with h-full so Recharts fills the available canvas.
  const heightClass =
    height === "full" ? "h-full min-h-[480px]" : "h-[200px] sm:h-[240px]";

  return (
    <div className={cn("space-y-4", height === "full" && "flex h-full flex-col")}>
      <Legend fcbName={fcbName} rivalName={rivalName} />

      {/* Mobile horizontal scroll wrapper — Recharts stays at 100%
          width but the inner box keeps a `min-width` so each matchday
          gets at least ~22px and the line stays readable. */}
      <div
        className={cn(
          "-mx-2 overflow-x-auto px-2 pb-1",
          height === "full" && "flex-1",
        )}
      >
        <div
          className={heightClass}
          style={{ minWidth: Math.max(rows.length * 22, 320) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              margin={{ top: 12, right: 16, bottom: 12, left: 0 }}
            >
              <defs>
                <linearGradient id="fcb-stroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--accent-blue)" />
                  <stop offset="100%" stopColor="var(--accent-gold)" />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--glass-border)"
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="matchday"
                stroke="var(--glass-border)"
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 11,
                  fontFamily: "var(--font-display), sans-serif",
                  letterSpacing: "0.08em",
                }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                label={{
                  value: "Forduló",
                  position: "insideBottom",
                  offset: -2,
                  fill: "var(--text-muted)",
                  fontSize: 10,
                  letterSpacing: "0.3em",
                }}
              />
              <YAxis
                stroke="var(--glass-border)"
                tick={{
                  fill: "var(--text-muted)",
                  fontSize: 11,
                  fontFamily: "var(--font-display), sans-serif",
                }}
                tickLine={false}
                axisLine={false}
                width={32}
                label={{
                  value: "Pont",
                  angle: -90,
                  position: "insideLeft",
                  offset: 12,
                  fill: "var(--text-muted)",
                  fontSize: 10,
                  letterSpacing: "0.3em",
                }}
              />
              <Tooltip
                cursor={{
                  stroke: "var(--accent-gold)",
                  strokeOpacity: 0.4,
                  strokeDasharray: "3 4",
                }}
                content={
                  <PointsTooltip
                    fcbName={fcbName}
                    rivalName={rivalName}
                  />
                }
              />
              {rivalName && (
                <Line
                  type="monotone"
                  dataKey="rival_points"
                  name={rivalName}
                  stroke="var(--accent-red)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "var(--accent-red)",
                    stroke: "var(--bg-primary)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={!reduced}
                  animationDuration={1100}
                  animationEasing="ease-out"
                  connectNulls
                />
              )}
              <Line
                type="monotone"
                dataKey="fcb_points"
                name={fcbName}
                stroke="url(#fcb-stroke)"
                strokeWidth={3}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: "var(--accent-gold)",
                  stroke: "var(--bg-primary)",
                  strokeWidth: 2,
                }}
                isAnimationActive={!reduced}
                animationDuration={1100}
                animationEasing="ease-out"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend + tooltip
// ---------------------------------------------------------------------------

function Legend({
  fcbName,
  rivalName,
}: {
  fcbName: string;
  rivalName: string | null;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-secondary)]">
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className="block h-[3px] w-6 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, var(--accent-blue), var(--accent-gold))",
          }}
        />
        <span className="font-medium text-[var(--text-primary)]">
          {fcbName}
        </span>
      </li>
      {rivalName && (
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="block h-[3px] w-6 rounded-full bg-[var(--accent-red)]"
          />
          <span>{rivalName}</span>
        </li>
      )}
    </ul>
  );
}

interface RechartsTooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  label?: number | string;
}

function PointsTooltip(
  props: RechartsTooltipPayload & {
    fcbName: string;
    rivalName: string | null;
  },
) {
  const { active, payload, label, fcbName, rivalName } = props;
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg-strong)] backdrop-blur-md",
        "px-3 py-2 text-xs shadow-[var(--shadow-md)]",
      )}
    >
      <p className="font-display text-[11px] uppercase tracking-[0.25em] text-[var(--accent-gold)]">
        {label}. forduló
      </p>
      <ul className="mt-2 space-y-1">
        <TooltipRow
          color="var(--accent-gold)"
          name={fcbName}
          points={row.fcb_points}
          gd={row.fcb_gd}
          pos={row.fcb_pos}
        />
        {rivalName && (
          <TooltipRow
            color="var(--accent-red)"
            name={rivalName}
            points={row.rival_points}
            gd={row.rival_gd}
            pos={row.rival_pos}
          />
        )}
      </ul>
    </div>
  );
}

function TooltipRow({
  color,
  name,
  points,
  gd,
  pos,
}: {
  color: string;
  name: string;
  points: number | null;
  gd: number | null;
  pos: number | null;
}) {
  if (points === null) return null;
  return (
    <li className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className="block h-2 w-2 rounded-full"
          style={{ background: color }}
        />
        <span className="text-[var(--text-primary)]">{name}</span>
      </span>
      <span className="flex items-center gap-3 tabular-nums text-[var(--text-secondary)]">
        <span>
          <span className="font-display text-base text-[var(--text-primary)]">
            {points}
          </span>{" "}
          pt
        </span>
        <span>{(gd ?? 0) >= 0 ? `+${gd}` : `${gd}`} gk</span>
        <span>#{pos}</span>
      </span>
    </li>
  );
}
