export type DashboardTimeframe =
  | "1m" | "3m" | "6m" | "ytd"
  | "1y" | "2y" | "3y" | "5y" | "10y"
  | "all" | "custom";

export const dashboardTimeframes: { label: string; value: DashboardTimeframe }[] = [
  { label: "1M",     value: "1m"     },
  { label: "3M",     value: "3m"     },
  { label: "6M",     value: "6m"     },
  { label: "YTD",    value: "ytd"    },
  { label: "1Y",     value: "1y"     },
  { label: "2Y",     value: "2y"     },
  { label: "3Y",     value: "3y"     },
  { label: "5Y",     value: "5y"     },
  { label: "10Y",    value: "10y"    },
  { label: "All",    value: "all"    },
  { label: "Custom", value: "custom" },
];

/** ISO date string cutoff for filtering COT data (undefined = no cutoff). */
export function cotCutoffFor(
  timeframe: DashboardTimeframe,
  latestDate: string,
  customFrom?: string,
): string | undefined {
  if (timeframe === "all") return undefined;
  if (timeframe === "custom") return customFrom;
  if (timeframe === "ytd") return `${new Date().getUTCFullYear()}-01-01`;

  const months: Partial<Record<DashboardTimeframe, number>> = {
    "1m": 1, "3m": 3, "6m": 6,
    "1y": 12, "2y": 24, "3y": 36, "5y": 60, "10y": 120,
  };
  const m = months[timeframe];
  if (!m) return undefined;

  const d = new Date(`${latestDate}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() - m);
  return d.toISOString().slice(0, 10);
}

