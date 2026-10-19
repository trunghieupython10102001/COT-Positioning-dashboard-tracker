"use client";

import { useTheme } from "next-themes";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CotMetric } from "@/lib/analytics";

type CotIndexChartProps = {
  data: CotMetric[];
  label: string;
  color: string;
  thresholdLow?: number;
  thresholdHigh?: number;
  from?: string;
  to?: string;
};

function toMs(date: string) {
  return new Date(date + "T00:00:00Z").getTime();
}

function formatTick(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function CotIndexChart({ data, label, color, thresholdLow = 10, thresholdHigh = 90, from, to }: CotIndexChartProps) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== "light";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const tooltipBg = isDark ? "#020617" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const tooltipFg = isDark ? "#f8fafc" : "#0f172a";

  const latest = data.at(-1);
  const chartData = data.map((d) => ({ ...d, _ts: toMs(d.reportDate) }));
  const domainFrom = from ? toMs(from) : "dataMin";
  const domainTo = to ? toMs(to) : "dataMax";

  return (
    <div className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-2xl dark:shadow-black/25">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</p>
        {latest && (
          <div className="flex gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              Index <span style={{ color }} className="font-mono">{latest.cotIndex}</span>
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              Pctile <span className="font-mono text-amber-500 dark:text-amber-300">{latest.percentile}</span>
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              % OI <span className={`font-mono ${latest.selectedNetPctOi >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}`}>{latest.selectedNetPctOi.toFixed(1)}%</span>
            </span>
          </div>
        )}
      </div>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="_ts"
              type="number"
              scale="time"
              domain={[domainFrom, domainTo]}
              tickFormatter={formatTick}
              stroke={axisColor}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis domain={[0, 100]} stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} ticks={[0, 10, 25, 50, 75, 90, 100]} width={32} />
            <Tooltip
              cursor={{ stroke: "#f59e0b", strokeWidth: 1 }}
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 16, color: tooltipFg }}
              labelFormatter={(ts) => new Date(ts as number).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}
              formatter={(value, name, props) => {
                const p = props.payload as CotMetric | undefined;
                if (!p) return [`${value}`, "COT Index"];
                return [
                  `Index: ${p.cotIndex}  |  Pctile: ${p.percentile}  |  % OI: ${p.selectedNetPctOi.toFixed(1)}%`,
                  "",
                ];
              }}
            />
            <ReferenceArea y1={0} y2={thresholdLow} fill="#22c55e" fillOpacity={isDark ? 0.07 : 0.1} />
            <ReferenceArea y1={thresholdHigh} y2={100} fill="#ef4444" fillOpacity={isDark ? 0.07 : 0.1} />
            <ReferenceLine y={thresholdLow} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1} label={{ value: `${thresholdLow}`, fill: "#22c55e", fontSize: 10, position: "right" }} />
            <ReferenceLine y={thresholdHigh} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1} label={{ value: `${thresholdHigh}`, fill: "#ef4444", fontSize: 10, position: "right" }} />
            <Line
              dataKey="cotIndex"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, fill: color }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

type NetPositionChartProps = {
  data: CotMetric[];
  label: string;
  from?: string;
  to?: string;
};

export function NetPositionChart({ data, label, from, to }: NetPositionChartProps) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== "light";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const tooltipBg = isDark ? "#020617" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const tooltipFg = isDark ? "#f8fafc" : "#0f172a";

  const chartData = data.map((d) => ({ ...d, _ts: toMs(d.reportDate) }));
  const domainFrom = from ? toMs(from) : "dataMin";
  const domainTo = to ? toMs(to) : "dataMax";

  return (
    <div className="h-[26rem] w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-2xl dark:shadow-black/25">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="net" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="_ts"
            type="number"
            scale="time"
            domain={[domainFrom, domainTo]}
            tickFormatter={formatTick}
            stroke={axisColor}
            tick={{ fontSize: 12, fill: axisColor }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} tickLine={false} axisLine={false} width={60} />
          <Tooltip
            cursor={{ stroke: "#f59e0b", strokeWidth: 1 }}
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 16, color: tooltipFg }}
            labelFormatter={(ts) => new Date(ts as number).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}
          />
          <Area dataKey="selectedNet" name={label} stroke="#38bdf8" strokeWidth={2} fill="url(#net)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type PctOiSeries = { label: string; color: string; data: CotMetric[] };

type PctOiChartProps = {
  series: PctOiSeries[];
  from?: string;
  to?: string;
};

export function PctOiChart({ series, from, to }: PctOiChartProps) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== "light";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const tooltipBg = isDark ? "#020617" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const tooltipFg = isDark ? "#f8fafc" : "#0f172a";

  // Merge every series onto a shared timestamp key (s0, s1, …)
  const tsMap = new Map<number, Record<string, number>>();
  series.forEach((item, index) => {
    for (const d of item.data) {
      const t = toMs(d.reportDate);
      tsMap.set(t, { ...tsMap.get(t), _ts: t, [`s${index}`]: d.selectedNetPctOi });
    }
  });
  const chartData = Array.from(tsMap.values()).sort((a, b) => a._ts - b._ts);

  const domainFrom = from ? toMs(from) : "dataMin";
  const domainTo = to ? toMs(to) : "dataMax";

  return (
    <div className="w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-2xl dark:shadow-black/25">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">% Net / Open Interest</p>
        <div className="flex flex-wrap gap-2">
          {series.map((item) => {
            const latest = item.data.at(-1);
            return latest ? (
              <span key={item.label} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                <span className="mr-1" style={{ color: item.color }}>●</span>{item.label} <span className="font-mono" style={{ color: item.color }}>{latest.selectedNetPctOi.toFixed(1)}%</span>
              </span>
            ) : null;
          })}
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={chartData}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="_ts"
              type="number"
              scale="time"
              domain={[domainFrom, domainTo]}
              tickFormatter={formatTick}
              stroke={axisColor}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 11, fill: axisColor }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v}%`}
              width={44}
            />
            <ReferenceLine y={0} stroke={axisColor} strokeDasharray="4 3" strokeWidth={1} />
            <Tooltip
              cursor={{ stroke: "#f59e0b", strokeWidth: 1 }}
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 16, color: tooltipFg }}
              labelFormatter={(ts) => new Date(ts as number).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}
              formatter={(value: unknown, name) => [`${(value as number).toFixed(1)}%`, name ?? ""]}
            />
            {series.map((item, index) => (
              <Line key={item.label} dataKey={`s${index}`} name={item.label} stroke={item.color} strokeWidth={1.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function LongShortChart({ data }: { data: CotMetric[] }) {
  return (
    <div className="h-80 w-full min-w-0 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <BarChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="reportDate" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", borderRadius: 16, color: "#f8fafc" }} />
          <Legend wrapperStyle={{ color: "#cbd5e1" }} />
          <Bar dataKey="netLong" name="Long" fill="#22c55e" />
          <Bar dataKey="netShort" name="Short" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OpenInterestChart({ data }: { data: CotMetric[] }) {
  return (
    <div className="h-80 w-full min-w-0 rounded-3xl border border-white/10 bg-slate-950/80 p-4 shadow-xl shadow-black/20 backdrop-blur-xl">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data}>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="reportDate" stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ background: "#020617", border: "1px solid #334155", borderRadius: 16, color: "#f8fafc" }} />
          <Area dataKey="openInterest" name="Open Interest" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b33" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
