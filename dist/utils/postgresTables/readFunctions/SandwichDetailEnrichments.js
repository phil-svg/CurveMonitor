import { Sandwiches } from "../../../models/Sandwiches.js";
import { getLabelNameFromAddress } from "./Labels.js";
import { txDetailEnrichment } from "./TxDetailEnrichment.js";
export async function SandwichDetailEnrichment(id) {
    const sandwich = await Sandwiches.findOne({
        where: { id },
    });
    if (!sandwich)
        return null;
    const frontrunTransaction = await txDetailEnrichment(sandwich.frontrun);
    if (!frontrunTransaction)
        return null;
    const backrunTransaction = await txDetailEnrichment(sandwich.backrun);
    if (!backrunTransaction)
        return null;
    let centerTransactions = [];
    let userLossesDetails = [];
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
    if (!label)
        label = "unknown";
    const sandwichDetail = {
        frontrun: frontrunTransaction,
        center: centerTransactions,
        backrun: backrunTransaction,
        user_losses_details: userLossesDetails,
        label: label,
    };
    return sandwichDetail;
}
//# sourceMappingURL=SandwichDetailEnrichments.js.map