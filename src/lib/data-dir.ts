import path from "node:path";

/** Directory holding generated COT + price JSON. Override with DATA_DIR on EC2. */
export function getDataDir(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), "src", "generated");
}
