"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

type TradingViewChartProps = {
  symbol: string;
  height?: number;
  range?: string;
  fromTimestamp?: number;
  toTimestamp?: number;
};

export function TradingViewChart({ symbol, height = 520, range = "12M", fromTimestamp, toTimestamp }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const tvTheme = mounted && resolvedTheme === "light" ? "light" : "dark";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    container.appendChild(widgetContainer);

    const config: Record<string, unknown> = {
      autosize: true,
      symbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: tvTheme,
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
    };

    if (fromTimestamp && toTimestamp) {
      config.from = fromTimestamp;
      config.to = toTimestamp;
    } else {
      config.range = range;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify(config);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol, range, fromTimestamp, toTimestamp, tvTheme]);

  return (
    <div
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950 dark:shadow-2xl dark:shadow-black/30"
      style={{ height }}
    >
      <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
    </div>
  );
}
