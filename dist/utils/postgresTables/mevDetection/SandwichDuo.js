function checkTransactionPattern(candidate) {
    if (candidate[0].trader === candidate[1].trader) {
        // Both txType = swap
        if (candidate[0].transaction_type === "swap" && candidate[1].transaction_type === "swap") {
            // coinId with direction "in" of tx0 = coinId "out" of tx1
            let tx0InCoin = candidate[0].transactionCoins.find((coin) => coin.direction === "in");
            let tx1OutCoin = candidate[1].transactionCoins.find((coin) => coin.direction === "out");
            // coinId "out" of tx0 = coinId "in" of tx1
            let tx0OutCoin = candidate[0].transactionCoins.find((coin) => coin.direction === "out");
            let tx1InCoin = candidate[1].transactionCoins.find((coin) => coin.direction === "in");
            if (tx0InCoin && tx1OutCoin && tx0OutCoin && tx1InCoin && tx0InCoin.coin_id === tx1OutCoin.coin_id && tx0OutCoin.coin_id === tx1InCoin.coin_id) {
                return true;
            }
        }
    }
    return false;
}
export async function candidateLength2(candidate) {
    // Check gap
    const GAP_IN_BLOCK = Math.abs(candidate[0].tx_position - candidate[1].tx_position);
    if (GAP_IN_BLOCK !== 2) {
        console.log(`Aborted, since gap is ${GAP_IN_BLOCK}.`);
        return;
    }
    // Check pattern
    const patternMatched = checkTransactionPattern(candidate);
    if (!patternMatched) {
        console.log(`Aborted, since transaction pattern does not match.`);
        return;
    }
    console.log("Candidate meets the conditions => Sandwich!");
}
//# sourceMappingURL=SandwichDuo.js.map