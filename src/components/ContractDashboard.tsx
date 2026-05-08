"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CotIndexChart } from "@/components/CotCharts";
import { PriceChart } from "@/components/PriceChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { buildMetrics, formatNumber, formatPct } from "@/lib/analytics";
import { ContractConfig } from "@/lib/contracts";
import type { CotRecord } from "@/lib/cot-data";
import type { PriceCandle } from "@/lib/price-data";
import {
  DashboardTimeframe,
  dashboardTimeframes,
  cotCutoffFor,
} from "@/lib/timeframes";

type ContractDashboardProps = {
  contract: ContractConfig;
  group: "speculators" | "commercials";
  records: CotRecord[];
  priceCandles: PriceCandle[];
};

const COT_DATA_START = "2010-01-01";

const LOOKBACK_PRESETS = [
  { label: "13W", weeks: 13, hint: "3M" },
  { label: "26W", weeks: 26, hint: "6M" },
  { label: "52W", weeks: 52, hint: "1Y" },
  { label: "156W", weeks: 156, hint: "3Y" },
] as const;

export function ContractDashboard({ contract, group, records, priceCandles }: ContractDashboardProps) {
  const [timeframe, setTimeframe] = useState<DashboardTimeframe>("1y");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [lookback, setLookback] = useState(156);
  const [isCustomLookback, setIsCustomLookback] = useState(false);
  const [customLookbackText, setCustomLookbackText] = useState("");

  // Compute metrics client-side so any lookback value is supported without a server round-trip.
  const specMetrics = useMemo(() => buildMetrics(records, "speculators", lookback), [records, lookback]);
  const largeSpecMetrics = useMemo(() => buildMetrics(records, "large-speculators", lookback), [records, lookback]);
  const commMetrics = useMemo(() => buildMetrics(records, "commercials", lookback), [records, lookback]);

  const metrics = group === "speculators" ? specMetrics : commMetrics;
  const latest = metrics.at(-1)!;

  function handleTimeframeChange(value: DashboardTimeframe) {
    if (value === "custom" && !customFrom) {
      const d = new Date(`${latest.reportDate}T00:00:00.000Z`);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      setCustomFrom(d.toISOString().slice(0, 10));
      setCustomTo(latest.reportDate);
    }
    setTimeframe(value);
  }

  function handleLookbackPreset(weeks: number) {
    setLookback(weeks);
    setIsCustomLookback(false);
  }

  function handleLookbackCustom() {
    setIsCustomLookback(true);
    setCustomLookbackText(lookback.toString());
  }

  function handleLookbackInput(raw: string) {
    setCustomLookbackText(raw);
    const n = parseInt(raw, 10);
    if (n >= 4 && n <= 520) setLookback(n);
  }

  const cutoff = cotCutoffFor(timeframe, latest.reportDate, customFrom || undefined);
  const cutoffTo = timeframe === "custom" ? (customTo || undefined) : undefined;

  function filterMetrics(data: typeof specMetrics) {
    return data.filter(
      (m) => (!cutoff || m.reportDate >= cutoff) && (!cutoffTo || m.reportDate <= cutoffTo),
    );
  }

  const visibleSpecMetrics = filterMetrics(specMetrics);
  const visibleLargeSpecMetrics = filterMetrics(largeSpecMetrics);
  const visibleCommMetrics = filterMetrics(commMetrics);

  const specLabel = contract.reportType === "financial" ? "Managed Money COT Index (Leveraged Funds)" : "Managed Money COT Index";
  const largeSpecLabel = contract.reportType === "financial" ? "Large Speculator COT Index (Leveraged + Other)" : "Large Speculator COT Index (MM + Other Rept)";
  const commLabel = contract.reportType === "financial" ? "Commercial COT Index (Dealer / Intermediary)" : "Commercial COT Index (Producer / Merchant)";
  const toggleBase = `/contracts/${contract.key}`;
  const netTone = latest.selectedNet >= 0
    ? "text-emerald-600 dark:text-emerald-300"
    : "text-rose-600 dark:text-rose-300";

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl">

        {/* Top nav */}
        <nav className="mb-5 flex items-center justify-between rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-black/20">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-slate-600 transition-colors duration-200 hover:text-cyan-600 dark:text-cyan-200 dark:hover:text-cyan-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to dashboard
          </Link>
          <ThemeToggle />
        </nav>

        {/* Hero */}
        <div className="mt-2 grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/30 lg:grid-cols-[1fr_380px] lg:p-8">
          <div>
            <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-200">
              {contract.assetClass} · {contract.exchange}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-6xl">
              {contract.name}
            </h1>
            <p className="mt-4 max-w-3xl text-slate-500 dark:text-slate-300">
              Price chart shows historical OHLCV data. COT positioning is weekly and delayed.
              The selected timeframe controls both the price chart and COT chart range.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Current signal group</p>
            <div className="mt-3 grid grid-cols-2 rounded-full bg-slate-100 p-1 text-sm font-semibold dark:bg-slate-950">
              <Link
                href={toggleBase}
                className={`rounded-full px-4 py-2 text-center transition-colors duration-200 ${group === "speculators" ? "bg-cyan-400 text-slate-950 dark:bg-cyan-300" : "text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/5"}`}
              >
                Speculators
              </Link>
              <Link
                href={`${toggleBase}?group=commercials`}
                className={`rounded-full px-4 py-2 text-center transition-colors duration-200 ${group === "commercials" ? "bg-cyan-400 text-slate-950 dark:bg-cyan-300" : "text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/5"}`}
              >
                Commercials
              </Link>
            </div>
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-300/20 dark:bg-amber-300/10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-200">Selected net</p>
              <p className={`mt-2 font-mono text-3xl font-semibold ${netTone}`}>{formatNumber(latest.selectedNet)}</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Report date", latest.reportDate],
            ["Net position", formatNumber(latest.selectedNet)],
            ["Net / open interest", formatPct(latest.selectedNetPctOi)],
            ["156w z-score", latest.zScore.toString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/75">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{label}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Timeframe selector */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/75">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="shrink-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Synced timeframe</p>
              <p className="text-sm text-slate-400 dark:text-slate-400">Applies to both the price chart and COT chart history.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {dashboardTimeframes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleTimeframeChange(item.value)}
                  className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                    timeframe === item.value
                      ? "bg-cyan-400 text-slate-950 dark:bg-cyan-300 dark:text-slate-950"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date inputs */}
          {timeframe === "custom" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">From</span>
              <input
                type="date"
                value={customFrom}
                min={COT_DATA_START}
                max={customTo || latest.reportDate}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 transition-colors focus:border-cyan-400 focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-cyan-300"
              />
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">to</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || COT_DATA_START}
                max={latest.reportDate}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 transition-colors focus:border-cyan-400 focus:outline-none dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-cyan-300"
              />
              {customFrom && customTo && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-400 dark:border-white/10 dark:bg-white/[0.04]">
                  {Math.round((new Date(customTo).getTime() - new Date(customFrom).getTime()) / (1000 * 60 * 60 * 24 * 30))} months
                </span>
              )}
            </div>
          )}
        </div>

        {/* Price chart */}
        <section className="mt-6 min-w-0">
          <PriceChart candles={priceCandles} from={cutoff} to={cutoffTo} height={520} />
        </section>

        {/* COT Index panels */}
        <section className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">Contrarian signal</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">COT Index (0–100)</h2>
            </div>

            {/* Lookback selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Lookback</span>
              <div className="flex flex-wrap items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold dark:border-white/10 dark:bg-slate-900">
                {LOOKBACK_PRESETS.map(({ label, weeks, hint }) => (
                  <button
                    key={weeks}
                    type="button"
                    title={hint}
                    onClick={() => handleLookbackPreset(weeks)}
                    className={`cursor-pointer rounded-full px-3 py-1 transition-colors duration-200 ${
                      !isCustomLookback && lookback === weeks
                        ? "bg-cyan-400 text-slate-950 dark:bg-cyan-300 dark:text-slate-950"
                        : "text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleLookbackCustom}
                  className={`cursor-pointer rounded-full px-3 py-1 transition-colors duration-200 ${
                    isCustomLookback
                      ? "bg-cyan-400 text-slate-950 dark:bg-cyan-300 dark:text-slate-950"
                      : "text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                  }`}
                >
                  Custom
                </button>
              </div>

              {isCustomLookback && (
                <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                  <input
                    type="number"
                    min={4}
                    max={520}
                    value={customLookbackText}
                    onChange={(e) => handleLookbackInput(e.target.value)}
                    placeholder="52"
                    className="w-14 bg-transparent font-mono text-xs text-slate-900 focus:outline-none dark:text-white"
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500">weeks</span>
                </div>
              )}

              <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">
                · Green ≤ 10 = extreme short · Red ≥ 90 = extreme long
              </span>
            </div>
          </div>

          <div className="grid gap-4">
            <CotIndexChart data={visibleLargeSpecMetrics} label={largeSpecLabel} color="#3b82f6" />
            <CotIndexChart data={visibleSpecMetrics} label={specLabel} color="#a855f7" />
            <CotIndexChart data={visibleCommMetrics} label={commLabel} color="#f59e0b" />
          </div>
        </section>

      </section>
    </main>
  );
}
