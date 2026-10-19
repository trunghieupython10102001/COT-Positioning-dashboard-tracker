import type { ReportType } from "./contracts";

/** CFTC report a trader group comes from: Legacy, Disaggregated or TFF (financial). */
export type CotReport = "L" | "D" | "F";

export type TraderGroupDef = { id: string; label: string };

export const REPORTS: Record<CotReport, { label: string; groups: TraderGroupDef[] }> = {
  L: {
    label: "Legacy",
    groups: [
      { id: "nc", label: "Non-Commercial" },
      { id: "comm", label: "Commercial" },
      { id: "nonrept", label: "Non-Reportable" },
    ],
  },
  D: {
    label: "Disaggregated",
    groups: [
      { id: "pm", label: "Producer / Merchant" },
      { id: "swap", label: "Swap Dealers" },
      { id: "mm", label: "Managed Money" },
      { id: "other", label: "Other Reportables" },
      { id: "nonrept", label: "Non-Reportable" },
    ],
  },
  F: {
    label: "TFF",
    groups: [
      { id: "dealer", label: "Dealer / Intermediary" },
      { id: "am", label: "Asset Manager" },
      { id: "lev", label: "Leveraged Funds" },
      { id: "other", label: "Other Reportables" },
      { id: "nonrept", label: "Non-Reportable" },
    ],
  },
};

/**
 * Net positioning = Σ long − Σ short over the chosen groups of a single report.
 * Groups are never mixed across reports: the reports re-slice the same open
 * interest, so e.g. Legacy Non-Commercial already contains Managed Money.
 */
export type Formula = { report: CotReport; groups: string[] };

export type NamedFormula = Formula & { label: string };

export function reportsFor(reportType: ReportType): CotReport[] {
  return reportType === "financial" ? ["L", "F"] : ["L", "D"];
}

export function formulaLabel(formula: Formula) {
  const defs = REPORTS[formula.report].groups;
  const names = formula.groups.map((id) => defs.find((group) => group.id === id)?.label ?? id);
  return `${names.join(" + ")} (${REPORTS[formula.report].label})`;
}

/** URL form: `L:nc` or `D:mm,other`. */
export function serializeFormula(formula: Formula) {
  return `${formula.report}:${formula.groups.join(",")}`;
}

export function parseFormula(value: string | undefined, reportType: ReportType): Formula | undefined {
  const match = value?.match(/^([LDF]):([a-z,]+)$/);
  if (!match) return undefined;

  const report = match[1] as CotReport;
  if (!reportsFor(reportType).includes(report)) return undefined;

  const requested = match[2].split(",");
  const groups = REPORTS[report].groups.map((group) => group.id).filter((id) => requested.includes(id));
  return groups.length > 0 ? { report, groups } : undefined;
}

type Defaults = {
  speculators: NamedFormula;
  commercials: NamedFormula;
  /** COT Index panels, in display order. */
  panels: NamedFormula[];
};

const LEGACY_NC: NamedFormula = { report: "L", groups: ["nc"], label: "Non-Commercial (Legacy)" };
const LEGACY_COMM: NamedFormula = { report: "L", groups: ["comm"], label: "Commercial (Legacy)" };
const MANAGED_MONEY: NamedFormula = { report: "D", groups: ["mm"], label: "Managed Money" };
const PRODUCER: NamedFormula = { report: "D", groups: ["pm"], label: "Commercial (Producer / Merchant)" };

/**
 * Headline numbers default to the Legacy report so they match the
 * "CFTC speculative net positions" series quoted by investing.com et al.
 * The finer-grained report's main speculator group gets its own panel.
 */
export function defaultFormulas(reportType: ReportType): Defaults {
  const speculatorPanel: NamedFormula =
    reportType === "financial"
      ? { report: "F", groups: ["lev"], label: "Leveraged Funds (TFF)" }
      : { ...MANAGED_MONEY, label: "Managed Money (Disaggregated)" };

  return {
    speculators: LEGACY_NC,
    commercials: LEGACY_COMM,
    panels: [LEGACY_NC, speculatorPanel, LEGACY_COMM],
  };
}

/** Common definitions offered as one-click starting points in the custom builder. */
export function formulaPresets(reportType: ReportType): NamedFormula[] {
  const legacy: NamedFormula[] = [
    LEGACY_NC,
    LEGACY_COMM,
    { report: "L", groups: ["nonrept"], label: "Small traders (Legacy Non-Reportable)" },
  ];

  if (reportType === "financial") {
    return [
      ...legacy,
      { report: "F", groups: ["lev"], label: "Leveraged Funds" },
      { report: "F", groups: ["am"], label: "Asset Managers" },
      { report: "F", groups: ["am", "lev"], label: "Asset Managers + Leveraged Funds" },
      { report: "F", groups: ["dealer"], label: "Dealers" },
    ];
  }

  return [
    ...legacy,
    MANAGED_MONEY,
    { report: "D", groups: ["mm", "other"], label: "Managed Money + Other Reportables" },
    PRODUCER,
    { report: "D", groups: ["pm", "swap"], label: "Producer + Swap Dealers" },
  ];
}
