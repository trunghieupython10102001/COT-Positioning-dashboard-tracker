import { CotRecord, TraderGroup, getContractRecords } from "./cot-data";

export type CotMetric = CotRecord & {
  specNet: number;
  commercialNet: number;
  nonReportableNet: number;
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

export function metricNet(record: CotRecord, group: Exclude<TraderGroup, "all">) {
  if (group === "speculators") return record.specLong - record.specShort;
  if (group === "large-speculators") {
    return (record.specLong + record.otherReptLong) - (record.specShort + record.otherReptShort);
  }
  return record.commercialLong - record.commercialShort;
}

export function buildMetrics(records: CotRecord[], group: Exclude<TraderGroup, "all">, lookbackWeeks: number = 156) {
  return records.map((record, index) => {
    const selectedNet = metricNet(record, group);
    const prior = records[index - 1];
    const priorNet = prior ? metricNet(prior, group) : selectedNet;
    const window = records.slice(Math.max(index - (lookbackWeeks - 1), 0), index + 1).map((item) => metricNet(item, group));

    return {
      ...record,
      specNet: record.specLong - record.specShort,
      commercialNet: record.commercialLong - record.commercialShort,
      nonReportableNet: record.nonReportableLong - record.nonReportableShort,
      selectedNet,
      selectedNetPctOi: Number(((selectedNet / record.openInterest) * 100).toFixed(1)),
      weeklyChange: selectedNet - priorNet,
      cotIndex: cotIndex(window, selectedNet),
      percentile: percentileRank(window, selectedNet),
      zScore: zScore(window, selectedNet),
    } satisfies CotMetric;
  });
}

export function latestMetric(contractKey: string, group: Exclude<TraderGroup, "all"> = "speculators") {
  const metrics = buildMetrics(getContractRecords(contractKey), group);
  return metrics.at(-1);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}
