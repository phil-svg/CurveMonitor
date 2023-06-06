import { candidateLength2 } from "./SandwichDuo.js";
function checkTransactionPattern(candidate) {
    // trader0 === trader2, but trader1 = other
    if (candidate[0].trader === candidate[2].trader && candidate[0].trader !== candidate[1].trader) {
        // txType0 = swap and txType2 = swap
        if (candidate[0].transaction_type === "swap" && candidate[2].transaction_type === "swap") {
            // coinId with direction "in" of tx0 = coinId "out" of tx2
            let tx0InCoin = candidate[0].transactionCoins.find((coin) => coin.direction === "in");
            let tx2OutCoin = candidate[2].transactionCoins.find((coin) => coin.direction === "out");
            // coinId "out" of tx0 = coinId "in" of tx2
            let tx0OutCoin = candidate[0].transactionCoins.find((coin) => coin.direction === "out");
            let tx2InCoin = candidate[2].transactionCoins.find((coin) => coin.direction === "in");
            if (tx0InCoin && tx2OutCoin && tx0OutCoin && tx2InCoin && tx0InCoin.coin_id === tx2OutCoin.coin_id && tx0OutCoin.coin_id === tx2InCoin.coin_id) {
                return true;
            }
        }
    }
    return false;
}
export async function candidateWithThreeConsecutiveTransactions(candidate) {
    let candidateMeetsConditions = checkTransactionPattern(candidate);
    if (!candidateMeetsConditions) {
        console.log("checkTransactionPattern spotted err, revert");
        return;
    }
    console.log("Candidate meets the conditions => Sandwich!");
}
// Candidate has 3 tx. Looking at their block_positions. Sorts the Candidate into three Cases:
// Case 1: The 3 tx are all side by-side.
// Case 2: Only 2 tx are neighbours
// Case 3: None are neigbhours.
export async function candidateLength3(candidate) {
    candidate.sort((a, b) => a.tx_position - b.tx_position);
    let i = 0;
    let flag = false;
    while (i < candidate.length - 1) {
        if (candidate[i + 1].tx_position === candidate[i].tx_position + 1) {
            if (i < candidate.length - 2 && candidate[i + 2].tx_position === candidate[i].tx_position + 2) {
                await candidateWithThreeConsecutiveTransactions([candidate[i], candidate[i + 1], candidate[i + 2]]);
                flag = true;
                i += 3;
            }
            else {
                i++;
            }
            continue;
        }
        if (candidate[i + 1].tx_position === candidate[i].tx_position + 2) {
            await candidateLength2([candidate[i], candidate[i + 1]]);
            flag = true;
            i += 2;
            continue;
        }
        if (candidate[i + 1].tx_position > candidate[i].tx_position + 2) {
            i++;
            continue;
        }
    }
    if (!flag) {
        console.log(`Aborted, no gap makes sense for sw.`);
    }
}
//# sourceMappingURL=SandwichTrio.js.map