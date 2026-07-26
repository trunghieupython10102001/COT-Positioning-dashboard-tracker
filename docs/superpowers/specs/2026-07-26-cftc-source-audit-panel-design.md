# CFTC Data Source Audit Panel — Design

**Date:** 2026-07-26
**Status:** Approved design (pending implementation plan)

## Problem

A user compared the app's AUD "Net Contracts" figure (+24,788, net long) against
investing.com's "CFTC AUD speculative net positions" (-37.7K, net short) for what
looked like the same report date and assumed the app had a data bug.

Root cause investigation (this session) found no bug: the app maps AUD to the
CFTC **TFF / Financial Futures Only** report and labels its "speculators" metric
from the **Leveraged Funds** column (`Lev_Money_Positions_Long/Short_All`,
`scripts/import-cftc.mjs:240-241`), while investing.com's figure is the classic
**Legacy report's Non-Commercial** net position — a differently-defined trader
bucket. Both numbers can be correct simultaneously; they just answer "who's net
long/short" for two different trader classifications.

Two follow-ups came out of that conversation:

1. **Done** (prior turn): the toggle label on `/contracts/[key]` now reads
   "Leveraged Funds" instead of "Speculators" for `reportType: "financial"`
   contracts (`src/components/ContractDashboard.tsx`), matching the naming
   convention already used by `specLabel`/`commLabel` for the COT Index charts.
2. **This spec**: give the user a way to independently verify, for any contract
   page they're looking at, that the numbers shown actually match what CFTC
   published — without needing to ask an LLM or trust the pipeline blindly.

## Goal

Add a **"Verify this data"** panel to `/contracts/[key]` that, for the
currently-displayed report date, makes the data provenance fully transparent and
gives the user a direct path to the raw CFTC source to cross-check by hand.

Non-goals (explicitly out of scope, per user's answers during brainstorming):
- No automatic server-side re-fetch/diff against CFTC.gov at request time.
- No date picker — only the latest report date (the one already shown in the
  "Report date" stat tile) needs auditing.
- No new backend service, database, or scheduled job.

## Location & trigger

A new collapsible `<details>`-style section on `/contracts/[key]`
(`src/components/ContractDashboard.tsx`), placed directly under the existing
stats row (Report date / Net contracts / Net-OI / 156w Z-score). Collapsed by
default. Title: **"Verify this data"**. Follows the same card styling
(`rounded-3xl border ... dark:bg-slate-950/75`) as the surrounding sections.

It reflects whatever `group` (Speculators/Leveraged Funds vs Commercials) is
currently toggled, and always describes `latest.reportDate` — i.e. exactly the
record already driving the visible stat tiles. No additional data fetching:
everything needed is already in `records`/`latest` plus static per-contract
config.

## Panel content

For the active contract + group + `latest.reportDate`:

1. **CFTC report used** — human label, e.g. `TFF – Financial Futures Only` or
   `Legacy – Disaggregated Futures Only`, derived from `contract.reportType`.
   Plus the matched CFTC market name(s), from `contract.cftcMarketNames`
   (already a client-safe field on `ContractConfig`).

2. **Source column mapping** — the exact CFTC column names behind the two
   numbers currently on screen for the active group, e.g. for AUD / Leveraged
   Funds: `Lev_Money_Positions_Long_All → specLong`,
   `Lev_Money_Positions_Short_All → specShort`. A small static lookup table
   keyed by `(reportType, group)` mirroring the branches already in
   `scripts/import-cftc.mjs:normalizeRecord` (financial: Leveraged
   Funds/Other Reportables/Dealer-Intermediary; disaggregated: Managed
   Money/Other Reportables/Producer-Merchant). This makes the classification
   explicit on-screen instead of only inferable from code.

3. **Raw values table** — for `latest`: `openInterest`, `specLong`,
   `specShort`, `commercialLong`, `commercialShort`, `otherReptLong`,
   `otherReptShort`, `nonReportableLong`, `nonReportableShort`, plus the net
   calc shown as an explicit equation, e.g. `24,788 = 187,442 − 162,654`
   (already-computed `selectedNet`, decomposed into its two source fields for
   the active group).

4. **Direct CFTC source link** — a static link to the actual government file
   covering `latest.reportDate`:
   - If `latest.reportDate` falls in the file CFTC currently serves as the
     live weekly flat file (`FinFutWk.txt` / `f_disagg.txt`), link straight to
     that `.txt` (human-readable in-browser, no download needed).
   - Otherwise, link to the historical `.zip` for that report's year
     (`https://www.cftc.gov/files/dea/history/{historicalPrefix}_{year}.zip`).
   - Either way, show a one-line instruction: "Download if zipped, then
     search for '<matched market name>' and '<report date>'."

5. **Known caveat callout** (static, always shown): a short note that
   "Leveraged Funds" (this report) is not the same trader bucket as
   "Non-Commercial" (Legacy report) shown by many third-party sites like
   investing.com/TradingView — numbers can legitimately differ in sign.

## Architecture

The CFTC URL patterns (`sources[].urls`, `historicalPrefix` per report type)
currently live only inside `scripts/import-cftc.mjs`, a Node-only script
outside the Next.js client bundle. Extract them into a new shared, client-safe
module:

```
src/lib/cftc-sources.ts
  export const CFTC_SOURCES: Record<ReportType, { liveUrl: string; historicalPrefix: string }>
  export function historicalZipUrl(reportType, year): string
```

- `scripts/import-cftc.mjs` imports from this module instead of hardcoding the
  same URLs a second time — single source of truth, no drift risk.
- The new audit panel (a small presentational component, e.g.
  `src/components/DataAuditPanel.tsx`) imports the same module to build its
  link, plus a small static `COLUMN_MAP` table (report type × group → source
  column names) colocated in the same file or a sibling
  `src/lib/cftc-column-map.ts`.
- No new server routes, no new fetches at request time — everything renders
  from props already passed into `ContractDashboard`.

## Edge cases

- **WTI proxy fallback**: `import-cftc.mjs` already has a special case where
  WTI's `specLong/Short` are backfilled from `otherReptLong/Short` when the
  Managed Money columns are empty (lines 285-289, 328-336). The column-mapping
  display for WTI should reflect this fallback explicitly (e.g. "Other
  Reportables (used as proxy — Managed Money field was empty)") rather than
  silently showing the Managed Money column names as if they were used
  directly.
- **Current-year historical zip**: no special-casing needed — CFTC updates
  the current year's historical zip weekly, same as the live flat file, so
  linking to the zip is always valid even for the most recent report.
- **Missing/zero data**: if all four spec fields are zero for the active
  group, show a note rather than a misleading `0 = 0 − 0` equation.

## Testing

Display-only feature over already-validated data — no new pipeline logic to
unit test beyond the small pure helpers (`historicalZipUrl`, column-map
lookup). Verification is manual:
- Open one `disaggregated` contract (e.g. Gold) and one `financial` contract
  (e.g. Australian Dollar), confirm the shown report type, market name,
  column names, and link all match reality.
- Confirm the panel collapses/expands correctly and doesn't break existing
  layout in both light and dark mode.
- Confirm the WTI proxy-fallback case renders its caveat instead of the
  normal Managed Money column names.
