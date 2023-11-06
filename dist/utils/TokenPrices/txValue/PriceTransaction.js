import { getCurrentTokenPriceFromDefiLlama } from "./DefiLlama.js";
export async function priceTransaction(enrichedTransaction) {
    let coins;
    switch (enrichedTransaction.transaction_type) {
        case "swap":
            coins = [...enrichedTransaction.coins_leaving_wallet, ...enrichedTransaction.coins_entering_wallet];
            for (const coin of coins) {
                const price = await getCurrentTokenPriceFromDefiLlama(coin.address);
                if (price !== null) {
                    return price * coin.amount; // Return as soon as we get a price.
                }
            }
            break;
        case "deposit":
        case "remove":
            coins = [...enrichedTransaction.coins_leaving_wallet, ...enrichedTransaction.coins_entering_wallet];
            let totalValue = 0;
            for (const coin of coins) {
                const price = await getCurrentTokenPriceFromDefiLlama(coin.address);
                if (price !== null) {
                    totalValue += price * coin.amount;
                }
            }
            if (totalValue > 0) {
                return totalValue; // Return the total value of the coins.
            }
            break;
        default:
            console.log(`Unknown transaction type: ${enrichedTransaction.transaction_type}`);
            break;
    }
    return null; // Return null if no price could be fetched for any coin.
}
//# sourceMappingURL=PriceTransaction.js.map