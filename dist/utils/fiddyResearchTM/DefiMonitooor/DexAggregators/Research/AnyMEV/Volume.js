export async function getFuzzyVolumeForGenericTx(contractAddress, cleanedTransfers, unixTimestamp) {
    contractAddress = contractAddress.toLowerCase();
    const isSwap = cleanedTransfers.some((transfer) => transfer.to.toLowerCase() === contractAddress) &&
        cleanedTransfers.some((transfer) => transfer.from.toLowerCase() === contractAddress);
    let vol = 0;
    for (const tranfer of cleanedTransfers) {
        const from = tranfer.from.toLowerCase();
        const to = tranfer.to.toLowerCase();
        if (from !== contractAddress && to !== contractAddress)
            continue;
        // hardcoding addresses to be able to ping DefiLlama for Base
        let tokenAddress = '';
        if (tranfer.tokenSymbol === 'USDC') {
            tokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        }
        if (tranfer.tokenSymbol === 'WETH') {
            tokenAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        }
        if (tokenAddress === '')
            continue;
        let price = 0;
        if (tranfer.tokenSymbol === 'USDC') {
            price = 1;
        }
        else if (tranfer.tokenSymbol === 'WETH') {
            price = 3200;
        }
        else {
            // price = (await getHistoricalTokenPriceFromDefiLlama(tokenAddress, unixTimestamp)) || 0;
        }
        if (isSwap) {
            if (vol !== 0)
                continue;
            vol = tranfer.parsedAmount * price;
        }
        else {
            // vol += tranfer.parsedAmount * price;
            return 0;
        }
    }
    if (vol === 0) {
        // console.log('failed to price tx.');
    }
    return vol;
}
//# sourceMappingURL=Volume.js.map