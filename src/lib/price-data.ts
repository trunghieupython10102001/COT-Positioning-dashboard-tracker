import { readFileSync } from "node:fs";
import path from "node:path";

export type PriceCandle = {
  time: string; // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
};

export function getPriceCandles(contractKey: string): PriceCandle[] {
  try {
    const filePath = path.join(
      process.cwd(),
      "src",
      "generated",
      "price-data",
      `${contractKey}.json`,
    );
    return JSON.parse(readFileSync(filePath, "utf-8")) as PriceCandle[];
  } catch {
    return [];
  }
}
