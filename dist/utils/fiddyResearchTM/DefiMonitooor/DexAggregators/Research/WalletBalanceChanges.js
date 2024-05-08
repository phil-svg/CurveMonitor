import fs from 'fs';
import { getTokenBalanceForWalletAndTokenAndBlockFromChain, getTokenDecimalsFromChain, } from '../../../../helperFunctions/Web3.js';
import { getBlockNumberAtTime } from '../../../curvefi/Tvl.js';
import { getTricrypto2Contract } from './Helper.js';
import { web3Call } from '../../../../web3Calls/generic.js';
function convertIntervalToBlockGap(interval) {
    const secondsPerBlock = 12;
    let seconds = 0;
    switch (interval.unit) {
        case 'minutes':
            seconds = interval.value * 60;
            break;
        case 'hours':
            seconds = interval.value * 60 * 60;
            break;
        case 'days':
            seconds = interval.value * 24 * 60 * 60;
            break;
    }
    return Math.floor(seconds / secondsPerBlock);
}
async function getBtcPriceFromTricrypto2ForBlockFromChain(blockNumber) {
    const contract = await getTricrypto2Contract();
    const btcPrice = (await web3Call(contract, 'get_dy', [1, 0, 100000000], blockNumber)) / 1e6;
    return btcPrice;
}
async function fetchTokenBalanceForWalletForTimeAndInterval(tokenAddress, decimals, walletAddress, startUnixtime, endUnixtime, interval) {
    const balances = [];
    const blockGap = convertIntervalToBlockGap(interval);
    let currentUnixtime = startUnixtime;
    let progress = 0;
    const totalIntervals = Math.ceil((endUnixtime - startUnixtime) / (blockGap * 12));
    while (currentUnixtime <= endUnixtime) {
        const blockNumber = getBlockNumberAtTime(currentUnixtime);
        const balance = await getTokenBalanceForWalletAndTokenAndBlockFromChain(tokenAddress, decimals, walletAddress, blockNumber);
        const btcPrice = await getBtcPriceFromTricrypto2ForBlockFromChain(blockNumber);
        const date = new Date(currentUnixtime * 1000).toISOString();
        balances.push({ date, balance, btcPrice });
        currentUnixtime += blockGap * 12; // Increment by the block gap in seconds
        progress++;
        console.log(`Progress: ${progress}/${totalIntervals}`);
    }
    fs.writeFileSync('balances.json', JSON.stringify(balances, null, 2));
}
export async function studyTokenBalanceOfWallet() {
    const wbtcAddress = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
    const walletAddress = '0xA69babEF1cA67A37Ffaf7a485DfFF3382056e78C';
    const tokenAddress = wbtcAddress;
    const decimals = await getTokenDecimalsFromChain(tokenAddress);
    // const startUnixtime = Math.floor(new Date('2022-12-15T00:00:00Z').getTime() / 1000);
    // const endUnixtime = Math.floor(Date.now() / 1000);
    const startDate = '2023-04-06T01:00:00Z';
    const endDate = '2023-04-11T19:00:00Z';
    const startUnixtime = Math.floor(new Date(startDate).getTime() / 1000);
    const endUnixtime = Math.floor(new Date(endDate).getTime() / 1000);
    const interval = { value: 30, unit: 'minutes' };
    await fetchTokenBalanceForWalletForTimeAndInterval(tokenAddress, decimals, walletAddress, startUnixtime, endUnixtime, interval);
    console.log('finished');
}
//# sourceMappingURL=WalletBalanceChanges.js.map