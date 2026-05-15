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

const sources = [
  {
    name: "disaggregated-futures-only",
    historicalPrefix: "fut_disagg_txt",
    urls: [
      "https://www.cftc.gov/dea/newcot/f_disagg.txt",
    ],
  },
  {
    name: "financial-futures-only",
    historicalPrefix: "fut_fin_txt",
    urls: [
      "https://www.cftc.gov/dea/newcot/FinFutWk.txt",
    ],
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
      const outputFile = path.join(outputDir, `${source.historicalPrefix}_${year}.zip`);

      // Completed years are immutable — skip if already cached.
      // The current year is updated weekly, so always refresh it.
      if (year < currentYear && await fileExists(outputFile)) continue;

      const url = `https://www.cftc.gov/files/dea/history/${source.historicalPrefix}_${year}.zip`;
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
  return files
    .filter(
      (file) =>
        file === `${source.name}.txt` ||
        file.startsWith(`${source.historicalPrefix}_`) && (file.endsWith(".zip") || file.endsWith(".txt")),
    )
    .map((file) => path.join(outputDir, file));
}

function readZipText(file) {
  const zip = new AdmZip(file);
  const entry = zip
    .getEntries()
    .find((candidate) => !candidate.isDirectory && candidate.entryName.toLowerCase().endsWith(".txt"));

  return entry ? entry.getData().toString("utf8") : "";
}

function parseDelimited(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const firstValues = splitLine(lines[0], delimiter);

  if (/^\d+$/.test(firstValues[1] ?? "")) {
    return lines.map((line) => splitLine(line, delimiter));
  }

  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);

  return lines.slice(1).map((line) => {
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

function numberValue(row, candidates) {
  for (const candidate of candidates) {
    const value = row[normalizeHeader(candidate)];
    if (value !== undefined && value !== "") return Number(value.replace(/,/g, ""));
  }

  return 0;
}

function textValue(row, candidates) {
  if (Array.isArray(row)) return "";

  for (const candidate of candidates) {
    const value = row[normalizeHeader(candidate)];
    if (value) return value;
  }

  return "";
}

function dateValue(row) {
  if (Array.isArray(row)) return row[2] ?? "";

  const value = textValue(row, ["Report_Date_as_YYYY-MM-DD", "Report_Date_as_MM_DD_YYYY", "As_of_Date_In_Form_YYMMDD"]);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [month, day, year] = value.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (/^\d{6}$/.test(value)) {
    return `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  }

  return value;
}

function normalizeRecord(row, contract) {
  if (Array.isArray(row)) return normalizePositionalRecord(row, contract);

  const common = {
    contractKey: contract.key,
    reportDate: dateValue(row),
    openInterest: numberValue(row, ["Open_Interest_All", "Open Interest"]),
    nonReportableLong: numberValue(row, ["NonRept_Positions_Long_All", "Nonreportable Positions-Long (All)"]),
    nonReportableShort: numberValue(row, ["NonRept_Positions_Short_All", "Nonreportable Positions-Short (All)"]),
  };

  if (contract.reportType === "financial") {
    return {
      ...common,
      specLong: numberValue(row, ["Lev_Money_Positions_Long_All", "Leveraged Funds-Long (All)"]),
      specShort: numberValue(row, ["Lev_Money_Positions_Short_All", "Leveraged Funds-Short (All)"]),
      otherReptLong: numberValue(row, ["Other_Rept_Positions_Long_All", "Other Reportables-Long (All)"]),
      otherReptShort: numberValue(row, ["Other_Rept_Positions_Short_All", "Other Reportables-Short (All)"]),
      commercialLong: numberValue(row, ["Dealer_Positions_Long_All", "Dealer/Intermediary-Long (All)"]),
      commercialShort: numberValue(row, ["Dealer_Positions_Short_All", "Dealer/Intermediary-Short (All)"]),
    };
  }

  return {
    ...common,
    specLong: numberValue(row, ["M_Money_Positions_Long_All", "Managed Money-Long (All)"]),
    specShort: numberValue(row, ["M_Money_Positions_Short_All", "Managed Money-Short (All)"]),
    otherReptLong: numberValue(row, ["Other_Rept_Positions_Long_All", "Other Reportables-Long (All)"]),
    otherReptShort: numberValue(row, ["Other_Rept_Positions_Short_All", "Other Reportables-Short (All)"]),
    commercialLong: numberValue(row, ["Prod_Merc_Positions_Long_All", "Producer/Merchant/Processor/User-Long (All)"]),
    commercialShort: numberValue(row, ["Prod_Merc_Positions_Short_All", "Producer/Merchant/Processor/User-Short (All)"]),
  };
}

function numericField(row, index) {
  return Number((row[index] ?? "0").replace(/,/g, "").trim()) || 0;
}

function normalizePositionalRecord(row, contract) {
  if (contract.reportType === "financial") {
    return {
      contractKey: contract.key,
      reportDate: row[2] ?? "",
      openInterest: numericField(row, 7),
      specLong: numericField(row, 14),
      specShort: numericField(row, 15),
      otherReptLong: numericField(row, 17),
      otherReptShort: numericField(row, 18),
      commercialLong: numericField(row, 8),
      commercialShort: numericField(row, 9),
      nonReportableLong: numericField(row, 22),
      nonReportableShort: numericField(row, 23),
    };
  }

  const specLong = numericField(row, 13);
  const specShort = numericField(row, 14);
  const otherReptLong = numericField(row, 16);
  const otherReptShort = numericField(row, 17);
  const shouldUseOtherReptAsSpecProxy =
    contract.key === "wti-crude-oil" &&
    specLong === 0 &&
    specShort === 0 &&
    (otherReptLong !== 0 || otherReptShort !== 0);

  return {
    contractKey: contract.key,
    reportDate: row[2] ?? "",
    openInterest: numericField(row, 7),
    specLong: shouldUseOtherReptAsSpecProxy ? otherReptLong : specLong,
    specShort: shouldUseOtherReptAsSpecProxy ? otherReptShort : specShort,
    otherReptLong,
    otherReptShort,
    commercialLong: numericField(row, 8),
    commercialShort: numericField(row, 9),
    nonReportableLong: numericField(row, 21),
    nonReportableShort: numericField(row, 22),
  };
}

async function normalizeFiles(outputDir) {
  const normalized = [];

  for (const source of sources) {
    const files = await findRawFiles(outputDir, source);
    if (files.length === 0) continue;

    const reportType = source.name.includes("financial") ? "financial" : "disaggregated";
    const reportContracts = contracts.filter((contract) => contract.reportType === reportType);

    for (const file of files) {
      const text = file.endsWith(".zip") ? readZipText(file) : await readFile(file, "utf8");
      const rows = parseDelimited(text);

      for (const row of rows) {
        const marketName = Array.isArray(row)
          ? row[0]
          : textValue(row, ["Market_and_Exchange_Names", "Market and Exchange Names"]);
        const contract = reportContracts.find((item) => item.names.includes(marketName));
        if (!contract) continue;

        const record = normalizeRecord(row, contract);
        if (
          record.contractKey === "wti-crude-oil" &&
          record.specLong === 0 &&
          record.specShort === 0 &&
          (record.otherReptLong !== 0 || record.otherReptShort !== 0)
        ) {
          record.specLong = record.otherReptLong;
          record.specShort = record.otherReptShort;
        }
        if (record.reportDate && record.openInterest > 0) normalized.push(record);
      }
    }
  }

  const byContractDate = new Map();
  for (const record of normalized) {
    const key = `${record.contractKey}:${record.reportDate}`;
    const existing = byContractDate.get(key);
    const recordHasSpec = record.specLong !== 0 || record.specShort !== 0;
    const existingHasSpec = existing && (existing.specLong !== 0 || existing.specShort !== 0);

    if (!existing || (recordHasSpec && !existingHasSpec)) {
      byContractDate.set(key, record);
    }
  }

  const deduped = Array.from(byContractDate.values());

  deduped.sort((a, b) =>
    a.contractKey === b.contractKey
      ? a.reportDate.localeCompare(b.reportDate)
      : a.contractKey.localeCompare(b.contractKey),
  );

  const generatedDir = path.join(process.cwd(), "src", "generated");
  await mkdir(generatedDir, { recursive: true });
  await writeFile(path.join(generatedDir, "cot-records.json"), `${JSON.stringify(deduped, null, 2)}\n`);
  console.log(`Normalized ${deduped.length} COT records to src/generated/cot-records.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
