"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { SofascoreGraphPoint } from "@/lib/season-api";
import { cn } from "@/lib/utils";
import { ChartZoomModal } from "./ChartZoomModal";
import { Maximize2 } from "lucide-react";

interface MomentumChartProps {
  graph: SofascoreGraphPoint[];
  homeTeam: string;
  awayTeam: string;
  index?: number;
}

/**
 * "Momentum" — per-minute pressure curve sourced from Sofascore.
 *
 * Sofascore's signal is a single number per minute in the range -100 .. +100,
 * with positive values meaning the home side is pressing and negative
 * values meaning the away side is. To shade each side with its own colour
 * we split the series into two clipped Areas:
 *   - `homeValue` = max(value, 0)  → blue, drawn above the y=0 line
 *   - `awayValue` = min(value, 0)  → red, drawn below the y=0 line
 *
 * Recharts handles the clipping for us via `baseValue={0}`; both Areas
 * share an axis so the silhouette stays continuous at the zero crossings.
 *
 * The card is zoomable via `ChartZoomModal` so users can scrutinise the
 * curve at 600px tall on demand.
 */
export function MomentumChart({
  graph,
  homeTeam,
  awayTeam,
  index = 0,
}: MomentumChartProps) {
  const reduced = useReducedMotion();
  const [zoomOpen, setZoomOpen] = useState(false);

  const { rows, homeMinutes, awayMinutes } = useMemo(() => {
    const rows = graph.map((p) => ({
      minute: p.minute,
      value: p.value,
      homeValue: p.value > 0 ? p.value : 0,
      awayValue: p.value < 0 ? p.value : 0,
    }));
    let homeMin = 0;
    let awayMin = 0;
    for (const p of graph) {
      if (p.value > 0) homeMin += 1;
      else if (p.value < 0) awayMin += 1;
    }
    return { rows, homeMinutes: homeMin, awayMinutes: awayMin };
  }, [graph]);

  if (!graph || graph.length === 0) return null;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 * index }}
        aria-label="Meccs momentum görbe"
        className={cn(
          "rounded-xl border border-[var(--glass-border)]",
          "bg-[var(--glass-bg)] p-4 backdrop-blur",
        )}
      >
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-[10px] uppercase tracking-[0.32em] text-[var(--accent-gold)]">
            Momentum
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <DominanceBadge
              color="var(--accent-blue)"
              label={homeTeam}
              minutes={homeMinutes}
              dir="up"
            />
            <DominanceBadge
              color="var(--accent-red)"
              label={awayTeam}
              minutes={awayMinutes}
              dir="down"
            />
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label="Nagyítás"
              title="Nagyítás"
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center",
                "rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)]",
                "text-[var(--text-secondary)]",
                "transition-colors duration-200",
                "hover:border-[var(--accent-gold)]/60 hover:bg-[var(--glass-bg-hover)] hover:text-[var(--accent-gold)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-gold)]",
              )}
            >
              <Maximize2 size={12} aria-hidden />
            </button>
          </div>
        </header>

        <MomentumBody
          rows={rows}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          reduced={reduced}
          height="compact"
        />
      </motion.section>

      <ChartZoomModal
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        title="Momentum"
        subtitle="Percenkénti nyomáskülönbség: pozitív = hazai dominancia, negatív = vendég dominancia."
      >
        <MomentumBody
          rows={rows}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          reduced={reduced}
          height="full"
        />
      </ChartZoomModal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

interface MomentumRow {
  minute: number;
  value: number;
  homeValue: number;
  awayValue: number;
}

function MomentumBody({
  rows,
  homeTeam,
  awayTeam,
  reduced,
  height = "compact",
}: {
  rows: MomentumRow[];
  homeTeam: string;
  awayTeam: string;
  reduced: boolean;
  height?: "compact" | "full";
}) {
  const heightClass =
    height === "full" ? "h-full min-h-[480px]" : "h-[160px] sm:h-[180px]";
  return (
    <div className={cn(height === "full" && "flex h-full flex-col")}>
      <div
        className={cn(
          "relative",
          heightClass,
          height === "full" && "flex-1",
        )}
      >
        {/* Decorative axis labels (Home ↑ / Away ↓) flanking the y axis */}
        <span className="pointer-events-none absolute left-0 top-1 font-display text-[9px] uppercase tracking-[0.24em] text-[var(--accent-blue)]">
          Hazai ↑
        </span>
        <span className="pointer-events-none absolute left-0 bottom-1 font-display text-[9px] uppercase tracking-[0.24em] text-[var(--accent-red)]">
          Vendég ↓
        </span>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 12, bottom: 16, left: 24 }}
          >
            <defs>
              <linearGradient id="momentum-home" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-blue)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--accent-blue)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="momentum-away" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-red)" stopOpacity={0.05} />
                <stop offset="100%" stopColor="var(--accent-red)" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--glass-border)"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="minute"
              type="number"
              domain={[0, "dataMax"]}
              tick={{
                fill: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-display), sans-serif",
              }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}'`}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[-100, 100]}
              ticks={[-100, -50, 0, 50, 100]}
              tick={{
                fill: "var(--text-muted)",
                fontSize: 10,
                fontFamily: "var(--font-display), sans-serif",
              }}
              tickLine={false}
              axisLine={false}
              width={28}
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
              content={
                <MomentumTooltip homeTeam={homeTeam} awayTeam={awayTeam} />
              }
            />
            <Area
              type="monotone"
              dataKey="homeValue"
              stroke="var(--accent-blue)"
              strokeWidth={1.5}
              fill="url(#momentum-home)"
              isAnimationActive={!reduced}
              animationDuration={900}
              animationEasing="ease-out"
              baseValue={0}
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="awayValue"
              stroke="var(--accent-red)"
              strokeWidth={1.5}
              fill="url(#momentum-away)"
              isAnimationActive={!reduced}
              animationDuration={900}
              animationEasing="ease-out"
              baseValue={0}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip + dominance badge
// ---------------------------------------------------------------------------

interface RechartsTooltipPayload {
  active?: boolean;
  payload?: Array<{ payload: MomentumRow }>;
  label?: number | string;
}

function MomentumTooltip(
  props: RechartsTooltipPayload & { homeTeam: string; awayTeam: string },
) {
  const { active, payload, label, homeTeam, awayTeam } = props;
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  const dominantTeam = row.value > 5 ? homeTeam : row.value < -5 ? awayTeam : null;
  const tone =
    row.value > 5
      ? "var(--accent-blue)"
      : row.value < -5
        ? "var(--accent-red)"
        : "var(--text-muted)";
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--glass-border)]",
        "bg-[var(--glass-bg-strong)] backdrop-blur-md",
        "px-3 py-2 text-xs shadow-[var(--shadow-md)]",
      )}
    >
      <p className="font-display text-[11px] uppercase tracking-[0.25em] text-[var(--accent-gold)]">
        {label}. perc
      </p>
      <p className="mt-1.5 text-[var(--text-secondary)]">
        {dominantTeam ? (
          <>
            <span style={{ color: tone }} className="font-medium">
              {dominantTeam}
            </span>
            <span> dominált</span>
            <span className="ml-2 font-display tabular-nums" style={{ color: tone }}>
              {row.value > 0 ? `+${Math.round(row.value)}` : Math.round(row.value)}
            </span>
          </>
        ) : (
          <span>Kiegyensúlyozott szakasz</span>
        )}
      </p>
    </div>
  );
}

function DominanceBadge({
  color,
  label,
  minutes,
  dir,
}: {
  color: string;
  label: string;
  minutes: number;
  dir: "up" | "down";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border",
        "border-[var(--glass-border)] bg-[var(--glass-bg)]",
        "px-2.5 py-1",
      )}
    >
      <span
        aria-hidden
        className="block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <span className="max-w-[110px] truncate text-[var(--text-primary)]">
        {label}
      </span>
      <span className="font-display tabular-nums" style={{ color }}>
        {dir === "up" ? "↑" : "↓"} {minutes}p
      </span>
    </span>
  );
}
