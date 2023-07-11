import { Sandwiches } from "../../../models/Sandwiches.js";
import { getModifiedPoolName } from "../../api/utils/SearchBar.js";
import { getLabelNameFromAddress } from "./Labels.js";
import { getAddressById } from "./Pools.js";
import { TransactionDetail, txDetailEnrichment } from "./TxDetailEnrichment.js";

function shortenAddress(address: string): string {
  return address.slice(0, 8) + ".." + address.slice(-6);
}

export interface UserLossDetail {
  unit: string;
  unitAddress: string;
  amount: number;
  lossInPercentage: number;
}

export interface SandwichDetail {
  frontrun: TransactionDetail;
  center: TransactionDetail[];
  backrun: TransactionDetail;
  user_losses_details: UserLossDetail[];
  label: string;
  poolAddress: string;
  poolName: string;
}

export async function SandwichDetailEnrichment(id: number): Promise<SandwichDetail | null> {
  const sandwich = await Sandwiches.findOne({
    where: { id },
  });

  if (!sandwich) return null;

  const frontrunTransaction = await txDetailEnrichment(sandwich.frontrun);
  if (!frontrunTransaction) return null;

  const backrunTransaction = await txDetailEnrichment(sandwich.backrun);
  if (!backrunTransaction) return null;

  let centerTransactions: TransactionDetail[] = [];
  let userLossesDetails: UserLossDetail[] = [];
  if (sandwich.loss_transactions) {
    for (const lossTransaction of sandwich.loss_transactions) {
      const centerTransaction = await txDetailEnrichment(lossTransaction.tx_id);
      if (centerTransaction) {
        centerTransactions.push(centerTransaction);
      }
      userLossesDetails.push({
        unit: lossTransaction.unit,
        unitAddress: lossTransaction.unitAddress,
        amount: lossTransaction.amount,
        lossInPercentage: lossTransaction.lossInPercentage,
      });
    }
  }

  let label = await getLabelNameFromAddress(centerTransactions[0].called_contract_by_user);
  if (!label || label.startsWith("Contract Address")) {
    label = centerTransactions[0].called_contract_by_user;
  }

  let poolAddress = await getAddressById(frontrunTransaction.pool_id);
  let poolName = await getModifiedPoolName(poolAddress!);

  const sandwichDetail: SandwichDetail = {
    frontrun: frontrunTransaction,
    center: centerTransactions,
    backrun: backrunTransaction,
    user_losses_details: userLossesDetails,
    label: label,
    poolAddress: poolAddress!,
    poolName: poolName!,
  };

  return sandwichDetail;
}

export async function enrichSandwiches(sandwichIds: number[]): Promise<(SandwichDetail | null)[]> {
  const enrichedSandwiches: (SandwichDetail | null)[] = await chunkedAsync(sandwichIds, 10, SandwichDetailEnrichment);
  return enrichedSandwiches;
}

async function chunkedAsync<T, U>(arr: T[], concurrency: number, worker: (item: T) => Promise<U>): Promise<U[]> {
  const results: U[] = [];
  const queue = arr.slice();

  while (queue.length > 0) {
    const tasks = queue.splice(0, concurrency).map(worker);
    const newResults = await Promise.all(tasks);
    results.push(...newResults);
  }

  return results;
}
