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
};

export function CotIndexChart({ data, label, color, thresholdLow = 10, thresholdHigh = 90 }: CotIndexChartProps) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== "light";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const tooltipBg = isDark ? "#020617" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const tooltipFg = isDark ? "#f8fafc" : "#0f172a";

  const latest = data.at(-1);

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
          <LineChart data={data}>
            <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="reportDate" stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} ticks={[0, 10, 25, 50, 75, 90, 100]} />
            <Tooltip
              cursor={{ stroke: "#f59e0b", strokeWidth: 1 }}
              contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 16, color: tooltipFg }}
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

export function NetPositionChart({ data }: { data: CotMetric[] }) {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme !== "light";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";
  const axisColor = isDark ? "#64748b" : "#94a3b8";
  const tooltipBg = isDark ? "#020617" : "#ffffff";
  const tooltipBorder = isDark ? "#334155" : "#e2e8f0";
  const tooltipFg = isDark ? "#f8fafc" : "#0f172a";

  return (
    <div className="h-[26rem] w-full min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-2xl dark:shadow-black/25">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="net" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="reportDate" stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} tickLine={false} axisLine={false} />
          <YAxis stroke={axisColor} tick={{ fontSize: 12, fill: axisColor }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "#f59e0b", strokeWidth: 1 }}
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 16, color: tooltipFg }}
          />
          <Area dataKey="selectedNet" name="Net Contracts" stroke="#38bdf8" strokeWidth={2} fill="url(#net)" />
        </AreaChart>
      </ResponsiveContainer>
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
          <Bar dataKey="specLong" name="Spec Long" fill="#22c55e" />
          <Bar dataKey="specShort" name="Spec Short" fill="#ef4444" />
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
