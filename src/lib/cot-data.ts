import generatedRecords from "@/generated/cot-records.json";

export type TraderGroup = "speculators" | "large-speculators" | "commercials" | "all";

export type CotRecord = {
  contractKey: string;
  reportDate: string;
  openInterest: number;
  specLong: number;
  specShort: number;
  otherReptLong: number;
  otherReptShort: number;
  commercialLong: number;
  commercialShort: number;
  nonReportableLong: number;
  nonReportableShort: number;
};

const weeks = [
  "2026-01-13",
  "2026-01-20",
  "2026-01-27",
  "2026-02-03",
  "2026-02-10",
  "2026-02-17",
  "2026-02-24",
  "2026-03-03",
  "2026-03-10",
  "2026-03-17",
  "2026-03-24",
  "2026-03-31",
  "2026-04-07",
  "2026-04-14",
  "2026-04-21",
  "2026-04-28",
];

const seeds: Record<string, { oi: number; spec: number; otherRept: number; commercial: number }> = {
  gold: { oi: 545000, spec: 185000, otherRept: 22000, commercial: -218000 },
  silver: { oi: 178000, spec: 52000, otherRept: 6000, commercial: -61000 },
  copper: { oi: 229000, spec: 31000, otherRept: 4000, commercial: -44000 },
  "wti-crude-oil": { oi: 1775000, spec: 246000, otherRept: 30000, commercial: -318000 },
  "natural-gas": { oi: 1430000, spec: -58000, otherRept: -8000, commercial: 22000 },
  "rbob-gasoline": { oi: 372000, spec: 66000, otherRept: 8000, commercial: -82000 },
  "euro-fx": { oi: 857000, spec: 74000, otherRept: 9000, commercial: -25000 },
  "british-pound": { oi: 282000, spec: 19000, otherRept: 3000, commercial: -12000 },
  "japanese-yen": { oi: 331000, spec: -62000, otherRept: -7000, commercial: 28000 },
  "australian-dollar": { oi: 218000, spec: -18000, otherRept: -2000, commercial: 10000 },
};

export const seedCotRecords: CotRecord[] = Object.entries(seeds).flatMap(
  ([contractKey, seed], contractIndex) =>
    weeks.map((reportDate, weekIndex) => {
      const drift = weekIndex - 7;
      const wave = Math.round(Math.sin((weekIndex + contractIndex) / 2) * 9000);
      const openInterest = seed.oi + drift * 4200 + wave;
      const specNet = seed.spec + drift * 3500 + wave;
      const otherReptNet = seed.otherRept + drift * 400 + Math.round(wave * 0.15);
      const commercialNet = seed.commercial - drift * 3100 - Math.round(wave * 0.8);

      return {
        contractKey,
        reportDate,
        openInterest,
        specLong: Math.round(openInterest * 0.34 + Math.max(specNet, 0)),
        specShort: Math.round(openInterest * 0.34 + Math.max(-specNet, 0)),
        otherReptLong: Math.round(openInterest * 0.05 + Math.max(otherReptNet, 0)),
        otherReptShort: Math.round(openInterest * 0.05 + Math.max(-otherReptNet, 0)),
        commercialLong: Math.round(openInterest * 0.38 + Math.max(commercialNet, 0)),
        commercialShort: Math.round(openInterest * 0.38 + Math.max(-commercialNet, 0)),
        nonReportableLong: Math.round(openInterest * 0.08),
        nonReportableShort: Math.round(openInterest * 0.08),
      };
    }),
);

export const cotRecords: CotRecord[] =
  generatedRecords.length > 0 ? (generatedRecords as CotRecord[]) : seedCotRecords;

export const isUsingGeneratedCotData = generatedRecords.length > 0;

export function getContractRecords(contractKey: string) {
  return cotRecords
    .filter((record) => record.contractKey === contractKey)
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}

export function hasCotRecords(contractKey: string) {
  return cotRecords.some((record) => record.contractKey === contractKey);
}

export function latestReportDate() {
  return cotRecords.reduce(
    (latest, record) => (record.reportDate > latest ? record.reportDate : latest),
    "",
  );
}
