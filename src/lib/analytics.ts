import { CotRecord, getContractRecords } from "./cot-data";
import { getContract } from "./contracts";
import { Formula, defaultFormulas } from "./formulas";

export type CotMetric = CotRecord & {
  netLong: number;
  netShort: number;
  selectedNet: number;
  selectedNetPctOi: number;
  weeklyChange: number;
  cotIndex: number;
  percentile: number;
  zScore: number;
};

function cotIndex(values: number[], value: number) {
  if (values.length < 2) return 50;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 50;
  return Math.round(((value - min) / (max - min)) * 100);
}

function percentileRank(values: number[], value: number) {
  if (values.length < 2) return 50;
  const lowerOrEqual = values.filter((candidate) => candidate <= value).length;
  return Math.round(((lowerOrEqual - 1) / (values.length - 1)) * 100);
}

function zScore(values: number[], value: number) {
  if (values.length < 2) return 0;
  const mean = values.reduce((total, candidate) => total + candidate, 0) / values.length;
  const variance =
    values.reduce((total, candidate) => total + (candidate - mean) ** 2, 0) /
    values.length;
  const deviation = Math.sqrt(variance);
  return deviation === 0 ? 0 : Number(((value - mean) / deviation).toFixed(2));
}

/** Σ long and Σ short over the formula's groups, or undefined if the record lacks any of them. */
export function formulaSides(record: CotRecord, formula: Formula): [number, number] | undefined {
  let long = 0;
  let short = 0;
  for (const group of formula.groups) {
    const position = record.positions?.[`${formula.report}.${group}`];
    if (!position) return undefined;
    long += position[0];
    short += position[1];
  }
  return [long, short];
}

export function buildMetrics(records: CotRecord[], formula: Formula, lookbackWeeks: number = 156) {
  // Weeks a report doesn't cover (e.g. Legacy-only 2009 rows for a TFF formula) are skipped.
  const rows = records.flatMap((record) => {
    const sides = formulaSides(record, formula);
    return sides ? [{ record, sides, net: sides[0] - sides[1] }] : [];
  });

  return rows.map(({ record, sides, net }, index) => {
    const priorNet = rows[index - 1]?.net ?? net;
    const window = rows.slice(Math.max(index - (lookbackWeeks - 1), 0), index + 1).map((row) => row.net);

    return {
      ...record,
      netLong: sides[0],
      netShort: sides[1],
      selectedNet: net,
      selectedNetPctOi: Number(((net / record.openInterest) * 100).toFixed(1)),
      weeklyChange: net - priorNet,
      cotIndex: cotIndex(window, net),
      percentile: percentileRank(window, net),
      zScore: zScore(window, net),
    } satisfies CotMetric;
  });
}

export function latestMetric(contractKey: string, formula?: Formula) {
  const contract = getContract(contractKey);
  if (!contract) return undefined;
  const metrics = buildMetrics(getContractRecords(contractKey), formula ?? defaultFormulas(contract.reportType).speculators);
  return metrics.at(-1);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}
