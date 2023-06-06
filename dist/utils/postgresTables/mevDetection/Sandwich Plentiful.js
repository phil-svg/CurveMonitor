function hasIdenticalTxPositions(candidate) {
    var _a;
    const initialTxPosition = (_a = candidate[0]) === null || _a === void 0 ? void 0 : _a.tx_position;
    return candidate.every((transaction) => transaction.tx_position === initialTxPosition);
}
function hasImpossibleGaps(candidate) {
    const sortedTxPositions = candidate.map((transaction) => transaction.tx_position).sort((a, b) => a - b);
    for (let i = 0; i < sortedTxPositions.length - 1; i++) {
        if (sortedTxPositions[i + 1] - sortedTxPositions[i] === 2) {
            return true;
        }
    }
    return false;
}
function hasNoTwoSwapsBySameUser(candidate) {
    const swapTransactions = candidate.filter((transaction) => transaction.transaction_type === "swap");
    const traderCounts = new Map();
    for (const transaction of swapTransactions) {
        traderCounts.set(transaction.trader, (traderCounts.get(transaction.trader) || 0) + 1);
    }
    for (const count of traderCounts.values()) {
        if (count > 1)
            return false;
    }
    return true;
}
export async function screenCandidate(candidate) {
    if (hasIdenticalTxPositions(candidate)) {
        console.log("Was just one big Tx.");
        return;
    }
    if (hasImpossibleGaps(candidate)) {
        console.log("Has impossible gaps.");
        return;
    }
    if (hasNoTwoSwapsBySameUser(candidate)) {
        console.log("No possibility for front+backrun found.");
        return;
    }
    console.dir(candidate, { depth: null, colors: true });
    console.log("needs further investigation in candidateLengthPlentiful");
}
//# sourceMappingURL=Sandwich%20Plentiful.js.map