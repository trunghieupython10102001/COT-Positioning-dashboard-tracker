import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatNumber, formatPct, latestMetric } from "@/lib/analytics";
import { contracts } from "@/lib/contracts";
import { isUsingGeneratedCotData, latestReportDate } from "@/lib/cot-data";

export default function Home() {
  const cards = contracts
    .map((contract) => ({ contract, metric: latestMetric(contract.key) }))
    .filter((item) => item.metric)
    .sort((a, b) => Math.abs(b.metric!.percentile - 50) - Math.abs(a.metric!.percentile - 50));

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-10">
      <section className="mx-auto max-w-7xl">
        <nav className="mb-5 flex items-center justify-between rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm shadow-slate-200/80 backdrop-blur-xl transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-black/30">
          <Link href="/" className="flex items-center gap-3 rounded-full focus-visible:outline-amber-400">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-50 text-sm font-black text-cyan-600 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-200">
              C
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">COT Radar</span>
              <span className="block text-xs text-slate-400 dark:text-slate-500">Positioning terminal</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/status"
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors duration-200 hover:border-cyan-400/40 hover:bg-cyan-50 hover:text-cyan-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-cyan-200 dark:hover:border-cyan-300/40 dark:hover:bg-cyan-300/10"
            >
              Data status
            </Link>
            <ThemeToggle />
          </div>
        </nav>

        <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/80 transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/80 dark:shadow-cyan-950/30 sm:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent dark:via-cyan-300/70" />
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/5 blur-3xl dark:bg-cyan-400/10" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative">
              <p className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-600 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-200">
                CFTC + TradingView
              </p>
              <h1 className="mt-5 max-w-5xl text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-6xl lg:text-7xl">
                Futures positioning, cleaned into a trading cockpit.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-500 dark:text-slate-300 sm:text-lg">
                Track delayed weekly COT positioning beside live/current futures price charts.
                Default signal is managed money for commodities and leveraged funds for FX.
              </p>
            </div>
            <div className="relative min-w-72 rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-300/20 dark:bg-amber-300/10">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-600 dark:text-cyan-200">Latest COT report</p>
              <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{latestReportDate()}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Weekly CFTC data. Price charts are live/current.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Markets", contracts.length.toString()],
            ["Asset classes", "Metals / Energy / FX"],
            ["Price charts", "TradingView live widgets"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-black/20">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Positioning Watchlist</h2>
              {isUsingGeneratedCotData ? (
                <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">
                  Showing contracts found in the imported weekly CFTC files.
                </p>
              ) : null}
            </div>
            <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 sm:inline-flex">
              Sorted by extremes
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ contract, metric }) => (
              <Link
                href={`/contracts/${contract.key}`}
                key={contract.key}
                className="group cursor-pointer rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-200 hover:border-cyan-400/50 hover:bg-cyan-50/50 dark:border-white/10 dark:bg-slate-950/75 dark:shadow-black/20 dark:hover:border-cyan-300/50 dark:hover:bg-slate-900/90"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">{contract.assetClass}</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900 transition-colors duration-200 group-hover:text-cyan-600 dark:text-white dark:group-hover:text-cyan-100">{contract.name}</h3>
                    <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">
                      COT {contract.cotFuturesSymbol} · Chart {contract.tradingViewSymbol}
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-600 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-200">
                    {metric!.percentile} pctile
                  </span>
                </div>
                <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-amber-400" style={{ width: `${metric!.percentile}%` }} />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
                    <p className="text-xs text-slate-400 dark:text-slate-500">Net contracts</p>
                    <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white">{formatNumber(metric!.specNet)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
                    <p className="text-xs text-slate-400 dark:text-slate-500">Net / OI</p>
                    <p className="mt-1 font-mono font-semibold text-slate-900 dark:text-white">{formatPct(metric!.selectedNetPctOi)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.03]">
                    <p className="text-xs text-slate-400 dark:text-slate-500">WoW</p>
                    <p className={metric!.weeklyChange >= 0 ? "mt-1 font-mono font-semibold text-emerald-600 dark:text-emerald-300" : "mt-1 font-mono font-semibold text-rose-600 dark:text-rose-300"}>
                      {formatNumber(metric!.weeklyChange)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
