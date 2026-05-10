"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  fetchStandingsEvolution,
  FCB_TEAM_ID,
  teamPointsSeries,
  type StandingsEvolutionResponse,
} from "@/lib/season-api";
import { cn } from "@/lib/utils";
import { ChartShell } from "./ChartShell";
import {
  CacheLabel,
  ChartSkeleton,
  EmptyBlock,
  ErrorBlock,
} from "./primitives";

interface GoalDifferenceChartProps {
  season: number;
  index?: number;
  className?: string;
}

/**
 * "Gólkülönbség evolúció" — cumulative GD area chart for FC Barcelona.
 *
 * Recharts does NOT natively support split positive/negative fills on a
 * single Area, so we render two stacked Areas:
 *   - `gd_pos` carries the value where it's >= 0, null otherwise
 *   - `gd_neg` carries the value where it's <= 0, null otherwise
 *
 * Both share the same x-axis and a `connectNulls` setting so the line
 * crosses the zero axis cleanly. A horizontal `ReferenceLine y={0}`
 * anchors the visual baseline.
 */
export function GoalDifferenceChart({
  season,
  index = 0,
  className,
}: GoalDifferenceChartProps) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<StandingsEvolutionResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
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
            : "A gólkülönbség adatai jelenleg nem elérhetők",
        );
        setLoaded(true);
      });
    return () => controller.abort();
  }, [season, retryNonce]);

  const rows = useMemo(() => {
    if (!data) return [];
    return teamPointsSeries(data.evolution, FCB_TEAM_ID).map((r) => ({
      matchday: r.matchday,
      gd: r.goal_difference,
      gd_pos: r.goal_difference >= 0 ? r.goal_difference : null,
      gd_neg: r.goal_difference <= 0 ? r.goal_difference : null,
    }));
  }, [data]);

  const peakGd = useMemo(() => {
    if (rows.length === 0) return 0;
    return rows.reduce((mx, r) => (r.gd > mx ? r.gd : mx), -Infinity);
  }, [rows]);

  return (
    <ChartShell
      eyebrow="Gólkülönbség"
      title="A támadójáték mérlege"
      description="Kumulatív gólkülönbség a szezon során. Pozitív értéknél zöld zóna, negatívnál piros — a nulla vonal a vízszintes mérce."
      meta={<CacheLabel cachedAt={data?.cached_at} stale={data?.stale} />}
      index={index}
      className={className}
      footer={
        rows.length > 0 ? (
          <p>
            Csúcs gólkülönbség az eddigi szezonban:{" "}
            <span className="font-display text-base text-[var(--accent-gold)]">
              {peakGd >= 0 ? `+${peakGd}` : peakGd}
            </span>
          </p>
        ) : null
      }
    >
      {!loaded ? (
        <ChartSkeleton height={320} />
      ) : errorMessage ? (
        <ErrorBlock
          message={errorMessage}
          onRetry={() => setRetryNonce((n) => n + 1)}
        />
      ) : rows.length === 0 ? (
        <EmptyBlock message="Nincs még lejátszott meccs ebben a szezonban." />
      ) : (
        <div className="-mx-2 overflow-x-auto px-2 pb-1">
          <div
            className="h-[300px] sm:h-[360px]"
            style={{ minWidth: Math.max(rows.length * 22, 320) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={rows}
                margin={{ top: 12, right: 16, bottom: 12, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="gd-pos-fill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--accent-gold)"
                      stopOpacity={0.55}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--accent-gold)"
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                  <linearGradient
                    id="gd-neg-fill"
                    x1="0"
                    y1="1"
                    x2="0"
                    y2="0"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--accent-red)"
                      stopOpacity={0.55}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--accent-red)"
                      stopOpacity={0.05}
                    />
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
                />
                <ReferenceLine
                  y={0}
                  stroke="var(--glass-border-hover)"
                  strokeWidth={1}
                />
                <Tooltip
                  cursor={{
                    stroke: "var(--accent-gold)",
                    strokeOpacity: 0.4,
                    strokeDasharray: "3 4",
                  }}
                  content={<GdTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="gd_pos"
                  stroke="var(--accent-gold)"
                  strokeWidth={2}
                  fill="url(#gd-pos-fill)"
                  isAnimationActive={!reduced}
                  animationDuration={1100}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="gd_neg"
                  stroke="var(--accent-red)"
                  strokeWidth={2}
                  fill="url(#gd-neg-fill)"
                  isAnimationActive={!reduced}
                  animationDuration={1100}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartShell>
  );
}

interface GdTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { matchday: number; gd: number } }>;
  label?: number | string;
}

function GdTooltip(props: GdTooltipProps) {
  const { active, payload, label } = props;
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const positive = row.gd >= 0;
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
      <p
        className={cn(
          "mt-1 font-display text-2xl",
          positive ? "text-[var(--accent-gold)]" : "text-[var(--accent-red)]",
        )}
      >
        {positive ? "+" : ""}
        {row.gd}
      </p>
      <p className="text-[var(--text-secondary)]">
        Kumulatív gólkülönbség
      </p>
    </div>
  );
}
