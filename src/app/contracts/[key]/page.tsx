export const revalidate = 3600;

import { notFound } from "next/navigation";
import { ContractDashboard, type SignalGroup } from "@/components/ContractDashboard";
import { getContractRecords, hasCotRecords, isUsingGeneratedCotData } from "@/lib/cot-data";
import { contracts, getContract } from "@/lib/contracts";
import { parseFormula } from "@/lib/formulas";
import { getPriceCandles } from "@/lib/price-data";

type ContractPageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ group?: string; f?: string }>;
};

export function generateStaticParams() {
  return contracts
    .filter((contract) => !isUsingGeneratedCotData() || hasCotRecords(contract.key))
    .map((contract) => ({ key: contract.key }));
}

export default async function ContractPage({ params, searchParams }: ContractPageProps) {
  const [{ key }, query] = await Promise.all([params, searchParams]);
  const contract = getContract(key);
  if (!contract) notFound();

  const records = getContractRecords(contract.key);
  if (records.length === 0) notFound();

  const group: SignalGroup =
    query.group === "commercials" || query.group === "custom" ? query.group : "speculators";
  const customFormula = parseFormula(query.f, contract.reportType);
  const priceCandles = getPriceCandles(contract.key);

  return (
    <ContractDashboard
      contract={contract}
      initialGroup={group}
      initialCustomFormula={customFormula}
      records={records}
      priceCandles={priceCandles}
    />
  );
}
