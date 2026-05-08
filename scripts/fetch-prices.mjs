import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import YahooFinance from "yahoo-finance2";
import { contracts } from "./contract-map.mjs";

const yahooFinance = new YahooFinance();

const PERIOD_START = "2010-01-01";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCandles(symbol) {
  const result = await yahooFinance.chart(symbol, {
    period1: PERIOD_START,
    interval: "1d",
  });

  const quotes = result.quotes ?? [];
  const candles = quotes
    .filter((q) => q.open != null && q.high != null && q.low != null && q.close != null)
    .map((q) => ({
      time: q.date.toISOString().slice(0, 10),
      open: Number(q.open.toFixed(4)),
      high: Number(q.high.toFixed(4)),
      low: Number(q.low.toFixed(4)),
      close: Number(q.close.toFixed(4)),
    }));

  // Yahoo Finance FX spot pairs (EURUSD=X etc.) return open ≈ close (UTC midnight mid-rate),
  // making candle bodies near-zero while wicks span the full intraday range.
  // Detect this by checking if >50% of candles have body < 10% of their range,
  // then fix by using prev-close as open — standard practice for 24-hr FX data.
  const sample = candles.slice(-60);
  const tinyBodyCount = sample.filter((c) => {
    const range = c.high - c.low;
    return range > 0 && Math.abs(c.close - c.open) / range < 0.1;
  }).length;

  if (tinyBodyCount / sample.length > 0.5) {
    for (let i = 1; i < candles.length; i++) {
      const open = candles[i - 1].close;
      const { high, low, close } = candles[i];
      candles[i] = {
        ...candles[i],
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
      };
    }
  }

  return candles;
}

async function main() {
  const outputDir = path.join(process.cwd(), "src", "generated", "price-data");
  await mkdir(outputDir, { recursive: true });

  for (const contract of contracts) {
    const { key, yahooFinanceSymbol } = contract;
    try {
      const candles = await fetchCandles(yahooFinanceSymbol);
      const outputFile = path.join(outputDir, `${key}.json`);
      await writeFile(outputFile, `${JSON.stringify(candles, null, 2)}\n`);
      console.log(`Saved ${candles.length} candles for ${key} (${yahooFinanceSymbol})`);
    } catch (error) {
      console.warn(`Failed to fetch ${key} (${yahooFinanceSymbol}): ${error.message}`);
    }
    await sleep(200);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
