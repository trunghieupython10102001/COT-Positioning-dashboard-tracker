import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import { contracts } from "./contract-map.mjs";

const execFileAsync = promisify(execFile);
const currentYear = new Date().getFullYear();
const startYear = Number(process.env.CFTC_START_YEAR ?? 2009);
const endYear = Number(process.env.CFTC_END_YEAR ?? currentYear);

// Every report is the Futures Only variant. `columns` lists the leading header
// names in file order; the live weekly flat files ship without a header row, so
// their values are mapped onto these names positionally.
const sources = [
  {
    name: "legacy-futures-only",
    report: "L",
    historicalFile: (year) => `deacot${year}.zip`,
    urls: ["https://www.cftc.gov/dea/newcot/deafut.txt"],
    columns: [
      "Market and Exchange Names", "As of Date in Form YYMMDD", "As of Date in Form YYYY-MM-DD",
      "CFTC Contract Market Code", "CFTC Market Code in Initials", "CFTC Region Code", "CFTC Commodity Code",
      "Open Interest (All)",
      "Noncommercial Positions-Long (All)", "Noncommercial Positions-Short (All)", "Noncommercial Positions-Spreading (All)",
      "Commercial Positions-Long (All)", "Commercial Positions-Short (All)",
      "Total Reportable Positions-Long (All)", "Total Reportable Positions-Short (All)",
      "Nonreportable Positions-Long (All)", "Nonreportable Positions-Short (All)",
    ],
    groups: {
      nc: ["Noncommercial Positions-Long (All)", "Noncommercial Positions-Short (All)"],
      comm: ["Commercial Positions-Long (All)", "Commercial Positions-Short (All)"],
      nonrept: ["Nonreportable Positions-Long (All)", "Nonreportable Positions-Short (All)"],
    },
  },
  {
    name: "disaggregated-futures-only",
    report: "D",
    historicalFile: (year) => `fut_disagg_txt_${year}.zip`,
    urls: ["https://www.cftc.gov/dea/newcot/f_disagg.txt"],
    columns: [
      "Market_and_Exchange_Names", "As_of_Date_In_Form_YYMMDD", "Report_Date_as_YYYY-MM-DD",
      "CFTC_Contract_Market_Code", "CFTC_Market_Code", "CFTC_Region_Code", "CFTC_Commodity_Code",
      "Open_Interest_All",
      "Prod_Merc_Positions_Long_All", "Prod_Merc_Positions_Short_All",
      "Swap_Positions_Long_All", "Swap__Positions_Short_All", "Swap__Positions_Spread_All",
      "M_Money_Positions_Long_All", "M_Money_Positions_Short_All", "M_Money_Positions_Spread_All",
      "Other_Rept_Positions_Long_All", "Other_Rept_Positions_Short_All", "Other_Rept_Positions_Spread_All",
      "Tot_Rept_Positions_Long_All", "Tot_Rept_Positions_Short_All",
      "NonRept_Positions_Long_All", "NonRept_Positions_Short_All",
    ],
    groups: {
      pm: ["Prod_Merc_Positions_Long_All", "Prod_Merc_Positions_Short_All"],
      swap: ["Swap_Positions_Long_All", "Swap__Positions_Short_All"],
      mm: ["M_Money_Positions_Long_All", "M_Money_Positions_Short_All"],
      other: ["Other_Rept_Positions_Long_All", "Other_Rept_Positions_Short_All"],
      nonrept: ["NonRept_Positions_Long_All", "NonRept_Positions_Short_All"],
    },
  },
  {
    name: "financial-futures-only",
    report: "F",
    historicalFile: (year) => `fut_fin_txt_${year}.zip`,
    urls: ["https://www.cftc.gov/dea/newcot/FinFutWk.txt"],
    columns: [
      "Market_and_Exchange_Names", "As_of_Date_In_Form_YYMMDD", "Report_Date_as_YYYY-MM-DD",
      "CFTC_Contract_Market_Code", "CFTC_Market_Code", "CFTC_Region_Code", "CFTC_Commodity_Code",
      "Open_Interest_All",
      "Dealer_Positions_Long_All", "Dealer_Positions_Short_All", "Dealer_Positions_Spread_All",
      "Asset_Mgr_Positions_Long_All", "Asset_Mgr_Positions_Short_All", "Asset_Mgr_Positions_Spread_All",
      "Lev_Money_Positions_Long_All", "Lev_Money_Positions_Short_All", "Lev_Money_Positions_Spread_All",
      "Other_Rept_Positions_Long_All", "Other_Rept_Positions_Short_All", "Other_Rept_Positions_Spread_All",
      "Tot_Rept_Positions_Long_All", "Tot_Rept_Positions_Short_All",
      "NonRept_Positions_Long_All", "NonRept_Positions_Short_All",
    ],
    groups: {
      dealer: ["Dealer_Positions_Long_All", "Dealer_Positions_Short_All"],
      am: ["Asset_Mgr_Positions_Long_All", "Asset_Mgr_Positions_Short_All"],
      lev: ["Lev_Money_Positions_Long_All", "Lev_Money_Positions_Short_All"],
      other: ["Other_Rept_Positions_Long_All", "Other_Rept_Positions_Short_All"],
      nonrept: ["NonRept_Positions_Long_All", "NonRept_Positions_Short_All"],
    },
  },
];

async function downloadSource(source) {
  const errors = [];

  for (const url of source.urls) {
    try {
      const tmpFile = path.join(process.cwd(), "data", "raw-cftc", `_tmp_${source.name}`);
      await downloadWithCurl(url, tmpFile);
      const buffer = await readFile(tmpFile);
      await deleteIfExists(tmpFile);
      const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
      return { url, contentType: isZip ? "application/zip" : "text/plain", buffer };
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
    }
  }

  throw new Error(`Failed to download ${source.name}: ${errors.join("; ")}`);
}

async function downloadWithCurl(url, outputFile) {
  await execFileAsync("curl", [
    "-L",
    "--fail",
    "--retry",
    "2",
    "-A",
    "Mozilla/5.0 COT-Dashboard/1.0",
    url,
    "-o",
    outputFile,
  ]);
}

async function main() {
  const outputDir = path.join(process.cwd(), "data", "raw-cftc");
  await mkdir(outputDir, { recursive: true });

  await downloadHistoricalFiles(outputDir);

  // Always re-download the live flat files — they are updated weekly by CFTC.
  // Only replace the cached copy after a successful download so stale data
  // is never lost to a transient network failure.
  for (const source of sources) {
    try {
      const result = await downloadSource(source);
      const extension = result.contentType.includes("zip") || result.url.endsWith(".zip") ? "zip" : "txt";
      const outputFile = path.join(outputDir, `${source.name}.${extension}`);
      // Remove the opposite-extension file if it exists so only one copy remains.
      await deleteIfExists(path.join(outputDir, `${source.name}.${extension === "txt" ? "zip" : "txt"}`));
      await writeFile(outputFile, result.buffer);
      console.log(`Updated ${source.name} from ${result.url}`);
    } catch (error) {
      console.warn(`${error.message} — keeping cached copy if available.`);
    }
  }

  await normalizeFiles(outputDir);
}

async function downloadHistoricalFiles(outputDir) {
  for (const source of sources) {
    for (let year = startYear; year <= endYear; year += 1) {
      const outputFile = path.join(outputDir, source.historicalFile(year));

      // Completed years are immutable — skip if already cached.
      // The current year is updated weekly, so always refresh it.
      if (year < currentYear && await fileExists(outputFile)) continue;

      const url = `https://www.cftc.gov/files/dea/history/${source.historicalFile(year)}`;
      try {
        await downloadWithCurl(url, outputFile);
        console.log(`${year < currentYear ? "Cached" : "Updated"} ${source.name} ${year}`);
      } catch {
        console.warn(`Could not download ${url}`);
      }
    }
  }
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function deleteIfExists(filePath) {
  try {
    await unlink(filePath);
  } catch {
    // file didn't exist — nothing to do
  }
}


async function findRawFiles(outputDir, source) {
  const files = await readdir(outputDir);
  const historical = new Set(Array.from({ length: endYear - startYear + 1 }, (_, i) => source.historicalFile(startYear + i)));
  return files
    .filter((file) => file === `${source.name}.txt` || historical.has(file))
    .map((file) => path.join(outputDir, file));
}

function readZipText(file) {
  const zip = new AdmZip(file);
  const entry = zip
    .getEntries()
    .find((candidate) => !candidate.isDirectory && candidate.entryName.toLowerCase().endsWith(".txt"));

  return entry ? entry.getData().toString("utf8") : "";
}

function parseDelimited(text, positionalColumns) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstValues = splitLine(lines[0], delimiter);
  const hasHeader = !/^\d+$/.test(firstValues[1] ?? "");
  const headers = (hasHeader ? firstValues : positionalColumns).map(normalizeHeader);

  return lines.slice(hasHeader ? 1 : 0).map((line) => {
    const values = splitLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitLine(line, delimiter) {
  const values = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ""));
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function numberValue(row, header) {
  const value = row[normalizeHeader(header)];
  return value ? Number(value.replace(/,/g, "")) || 0 : 0;
}

function dateValue(row) {
  const value = [
    "Report_Date_as_YYYY-MM-DD",
    "As of Date in Form YYYY-MM-DD",
    "Report_Date_as_MM_DD_YYYY",
    "As_of_Date_In_Form_YYMMDD",
  ]
    .map((header) => row[normalizeHeader(header)])
    .find(Boolean) ?? "";

  const datePart = value.split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
    const [month, day, year] = datePart.split("/");
    return `${year}-${month}-${day}`;
  }
  if (/^\d{6}$/.test(datePart)) {
    return `20${datePart.slice(0, 2)}-${datePart.slice(2, 4)}-${datePart.slice(4, 6)}`;
  }

  return "";
}

async function normalizeFiles(outputDir) {
  const contractByCode = new Map(contracts.map((contract) => [contract.cftcCode, contract]));
  // One record per contract + report date, with long/short per trader group
  // from every report that covers it, keyed `${report}.${group}`.
  const byContractDate = new Map();

  for (const source of sources) {
    const files = await findRawFiles(outputDir, source);

    for (const file of files) {
      const text = file.endsWith(".zip") ? readZipText(file) : await readFile(file, "utf8");

      for (const row of parseDelimited(text, source.columns)) {
        const code = (row.cftc_contract_market_code ?? "").trim();
        const contract = contractByCode.get(code);
        if (!contract) continue;

        const reportDate = dateValue(row);
        const openInterest = numberValue(row, "Open_Interest_All");
        if (!reportDate || openInterest <= 0) continue;

        const key = `${contract.key}:${reportDate}`;
        const record = byContractDate.get(key) ?? { contractKey: contract.key, reportDate, openInterest, positions: {} };
        // The live flat file and the current-year zip overlap; the first copy wins.
        if (record.positions[`${source.report}.${Object.keys(source.groups)[0]}`]) continue;

        // Legacy and Disaggregated/TFF futures-only open interest are identical;
        // prefer the contract's own report when both are present.
        if (source.report !== "L") record.openInterest = openInterest;
        for (const [group, [longHeader, shortHeader]] of Object.entries(source.groups)) {
          record.positions[`${source.report}.${group}`] = [numberValue(row, longHeader), numberValue(row, shortHeader)];
        }
        byContractDate.set(key, record);
      }
    }
  }

  const records = Array.from(byContractDate.values());

  records.sort((a, b) =>
    a.contractKey === b.contractKey
      ? a.reportDate.localeCompare(b.reportDate)
      : a.contractKey.localeCompare(b.contractKey),
  );

  const generatedDir = process.env.DATA_DIR ?? path.join(process.cwd(), "src", "generated");
  await mkdir(generatedDir, { recursive: true });
  await writeFile(path.join(generatedDir, "cot-records.json"), `${JSON.stringify(records)}\n`);
  console.log(`Normalized ${records.length} COT records to ${path.join(generatedDir, "cot-records.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
