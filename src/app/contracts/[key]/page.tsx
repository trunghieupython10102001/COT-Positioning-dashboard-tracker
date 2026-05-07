import { notFound } from "next/navigation";
import { ContractDashboard } from "@/components/ContractDashboard";
import { buildMetrics } from "@/lib/analytics";
import { getContractRecords, hasCotRecords, isUsingGeneratedCotData } from "@/lib/cot-data";
import { contracts, getContract } from "@/lib/contracts";

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
  const specMetrics = buildMetrics(records, "speculators");
  const largeSpecMetrics = buildMetrics(records, "large-speculators");
  const commMetrics = buildMetrics(records, "commercials");
  const metrics = group === "speculators" ? specMetrics : commMetrics;
  if (!metrics.at(-1)) notFound();

  return <ContractDashboard contract={contract} group={group} metrics={metrics} specMetrics={specMetrics} largeSpecMetrics={largeSpecMetrics} commMetrics={commMetrics} />;
}
