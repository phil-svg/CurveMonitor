import { Sandwiches } from "../../../models/Sandwiches.js";
import { getModifiedPoolName } from "../../api/utils/SearchBar.js";
import { getLabelNameFromAddress } from "./Labels.js";
import { getAddressById } from "./Pools.js";
import { TransactionDetail, txDetailEnrichment } from "./TxDetailEnrichment.js";

export interface UserLossDetail {
  unit: string;
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
        amount: lossTransaction.amount,
        lossInPercentage: lossTransaction.lossInPercentage,
      });
    }
  }

  let label = await getLabelNameFromAddress(centerTransactions[0].called_contract_by_user);
  if (!label) label = "unknown";

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
