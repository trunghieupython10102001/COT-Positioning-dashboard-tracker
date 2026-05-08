"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createChart, AreaSeries, CandlestickSeries } from "lightweight-charts";
import { useTheme } from "next-themes";
import type { ISeriesApi, IChartApi, SeriesType } from "lightweight-charts";
import type { PriceCandle } from "@/lib/price-data";

type ChartType = "area" | "candlestick";

type PriceChartProps = {
  candles: PriceCandle[];
  from?: string;
  to?: string;
  height?: number;
};

const LIGHT = {
  bg: "#ffffff",
  text: "#334155",
  grid: "rgba(148,163,184,0.2)",
  border: "rgba(148,163,184,0.3)",
  line: "#0891b2",
  top: "rgba(8,145,178,0.18)",
  bottom: "rgba(8,145,178,0)",
  up: "#16a34a",
  down: "#dc2626",
};

const DARK = {
  bg: "transparent",
  text: "#94a3b8",
  grid: "rgba(148,163,184,0.08)",
  border: "rgba(148,163,184,0.12)",
  line: "#38bdf8",
  top: "rgba(56,189,248,0.20)",
  bottom: "rgba(56,189,248,0)",
  up: "#22c55e",
  down: "#ef4444",
};

export function PriceChart({ candles, from, to, height = 520 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const { resolvedTheme } = useTheme();
  const [chartType, setChartType] = useState<ChartType>("area");

  // Init chart only (no series) after layout so container has real dimensions
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const c = DARK;
    const w = Math.max(1, containerRef.current.getBoundingClientRect().width);
    const chart = createChart(containerRef.current, {
      width: w,
      height,
      layout: {
        background: { color: c.bg },
        textColor: c.text,
      },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      timeScale: {
        borderColor: c.border,
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: c.border,
      },
      crosshair: {
        vertLine: { color: "rgba(148,163,184,0.4)" },
        horzLine: { color: "rgba(148,163,184,0.4)" },
      },
      handleScroll: true,
      handleScale: true,
    });

    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0) chart.applyOptions({ width });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap series type, set data, and apply visible range
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove existing series before adding new one
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    const isDark = typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true;
    const c = isDark ? DARK : LIGHT;

    if (chartType === "area") {
      const s = chart.addSeries(AreaSeries, {
        lineColor: c.line,
        topColor: c.top,
        bottomColor: c.bottom,
        lineWidth: 2,
        priceLineVisible: false,
      });
      s.setData(candles.map((x) => ({ time: x.time, value: x.close })));
      seriesRef.current = s;
    } else {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: c.up,
        downColor: c.down,
        borderVisible: false,
        wickUpColor: c.up,
        wickDownColor: c.down,
      });
      s.setData(candles);
      seriesRef.current = s;
    }

    if (from) {
      const rangeTo = to ?? candles.at(-1)?.time;
      if (rangeTo) chart.timeScale().setVisibleRange({ from, to: rangeTo });
    } else {
      chart.timeScale().fitContent();
    }
  }, [chartType, candles, from, to]);

  // Sync theme colors — updates chart options and series colors without recreating
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const c = resolvedTheme === "dark" ? DARK : LIGHT;

    chart.applyOptions({
      layout: { background: { color: c.bg }, textColor: c.text },
      grid: {
        vertLines: { color: c.grid },
        horzLines: { color: c.grid },
      },
      timeScale: { borderColor: c.border },
      rightPriceScale: { borderColor: c.border },
    });

    if (chartType === "area") {
      series.applyOptions({ lineColor: c.line, topColor: c.top, bottomColor: c.bottom });
    } else {
      series.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down });
    }
  }, [resolvedTheme, chartType]);

  if (candles.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-[2rem] border border-slate-200 bg-slate-50 text-sm text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-500"
      >
        Price data not yet available
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/75">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500">Price</p>
        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold dark:border-white/10 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setChartType("area")}
            className={`cursor-pointer rounded-full px-3 py-1 transition-colors duration-200 ${
              chartType === "area"
                ? "bg-cyan-400 text-slate-950 dark:bg-cyan-300 dark:text-slate-950"
                : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
            }`}
          >
            Area
          </button>
          <button
            type="button"
            onClick={() => setChartType("candlestick")}
            className={`cursor-pointer rounded-full px-3 py-1 transition-colors duration-200 ${
              chartType === "candlestick"
                ? "bg-cyan-400 text-slate-950 dark:bg-cyan-300 dark:text-slate-950"
                : "text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
            }`}
          >
            Candles
          </button>
        </div>
      </div>
      <div ref={containerRef} style={{ height }} />
    </div>
  );
}
