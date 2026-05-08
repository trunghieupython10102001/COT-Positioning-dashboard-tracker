import { notFound } from "next/navigation";
import { ContractDashboard } from "@/components/ContractDashboard";
import { buildMetrics } from "@/lib/analytics";
import { getContractRecords, hasCotRecords, isUsingGeneratedCotData } from "@/lib/cot-data";
import { contracts, getContract } from "@/lib/contracts";
import { getPriceCandles } from "@/lib/price-data";

type ContractPageProps = {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ group?: string }>;
};

export function generateStaticParams() {
  return contracts
    .filter((contract) => !isUsingGeneratedCotData || hasCotRecords(contract.key))
    .map((contract) => ({ key: contract.key }));
}

export default async function ContractPage({ params, searchParams }: ContractPageProps) {
  const [{ key }, query] = await Promise.all([params, searchParams]);
  const contract = getContract(key);
  if (!contract) notFound();

  const group = query.group === "commercials" ? "commercials" : "speculators";
  const records = getContractRecords(contract.key);

  // Quick check that there is data before rendering the client component.
  const probe = buildMetrics(records, group);
  if (!probe.at(-1)) notFound();

  const priceCandles = getPriceCandles(contract.key);

  return <ContractDashboard contract={contract} group={group} records={records} priceCandles={priceCandles} />;
}
