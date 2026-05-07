import Link from "next/link";
import { contracts } from "@/lib/contracts";
import { cotRecords, isUsingGeneratedCotData, latestReportDate } from "@/lib/cot-data";

export default function StatusPage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <section className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-medium text-cyan-600 hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200">
          ← Back to dashboard
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">Data Status</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-300">
          {isUsingGeneratedCotData
            ? "The dashboard is using normalized records generated from official CFTC files."
            : "The dashboard is using seed COT data because no generated CFTC records are available yet."}
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Latest report", latestReportDate()],
            ["COT rows", cotRecords.length.toString()],
            ["Mapped contracts", contracts.length.toString()],
            ["Data mode", isUsingGeneratedCotData ? "Generated CFTC" : "Seed fallback"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/80">
              <p className="text-sm text-slate-400 dark:text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white transition-colors duration-300 dark:border-white/10 dark:bg-slate-900/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-400 dark:border-white/5 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Contract</th>
                <th className="px-5 py-3 font-semibold">CFTC report</th>
                <th className="px-5 py-3 font-semibold">COT futures</th>
                <th className="px-5 py-3 font-semibold">TradingView chart</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.key} className="border-t border-slate-100 dark:border-white/5">
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{contract.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">{contract.reportType}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">{contract.cotFuturesSymbol}</td>
                  <td className="px-5 py-3 text-cyan-600 dark:text-cyan-300">{contract.tradingViewSymbol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
