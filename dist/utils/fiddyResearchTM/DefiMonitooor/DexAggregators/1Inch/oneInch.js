import { Op } from 'sequelize';
import { Transactions } from '../../../../../models/Transactions.js';
import { findPoolId } from '../../../cexdex/ClusteredTxCoins.js';
import { TransactionDetails } from '../../../../../models/TransactionDetails.js';
import { TransactionCoins } from '../../../../../models/TransactionCoins.js';
import { Coins } from '../../../../../models/Coins.js';
import { getBalanceChangeForAddressFromTransfers } from '../../../../postgresTables/mevDetection/atomic/utils/atomicArbDetection.js';
import { getTxIdByTxHash, getUnixTimestampByTxId } from '../../../../postgresTables/readFunctions/Transactions.js';
import { getCoinIdByAddress } from '../../../../postgresTables/readFunctions/Coins.js';
import { getTokenPriceWithTimestampFromDb } from '../../../../postgresTables/readFunctions/PriceMap.js';
import { getCleanedTransfersForTxIdFromTable } from '../../../../postgresTables/readFunctions/CleanedTransfers.js';
import { getCleanedTransfersFor1inch } from '../../../../postgresTables/CleanedTransfers.js';
import { WEB3_HTTP_PROVIDER, getPastEvents } from '../../../../web3Calls/generic.js';
import fs from 'fs';
import { retry } from '../../../../helperFunctions/Web3Retry.js';
import { getInchv5Abi } from '../ABIs.js';
import { parse } from 'csv-parse';
// import { get1InchV5ListCompleteWithCleanedTransfers } from './v5ListCompleteWithCleanedTransfers.js';
// import { get1InchV6ListCompleteWithCleanedTransfers } from './v6ListCompleteWithCleanedTransfers.ts.js';
async function fetchTransactionsForPoolAndToAddressAndTimeDuration(poolAddress, toAddress, startDate, endDate) {
    const startUnixTime = new Date(startDate).getTime() / 1000;
    const endUnixTime = new Date(endDate).getTime() / 1000;
    const poolId = await findPoolId(poolAddress);
    if (poolId === null) {
        console.error('Pool not found');
        return [];
    }
    return await Transactions.findAll({
        where: {
            pool_id: poolId,
            block_unixtime: {
                [Op.gte]: startUnixTime,
                [Op.lte]: endUnixTime,
            },
        },
        include: [
            {
                model: TransactionDetails,
                where: { to: toAddress },
                required: true,
            },
            {
                model: TransactionCoins,
                include: [Coins],
            },
        ],
    });
}
export async function whatWasSwappedAnalytics(poolAddress, toAddress, startDate, endDate) {
    const transactions = await fetchTransactionsForPoolAndToAddressAndTimeDuration(poolAddress, toAddress, startDate, endDate);
    // Assuming balanceChanges is an array of { tokenAddress, balanceChange, tokenSymbol } for each transaction
    let swapVolumes = {};
    let transactionCount = 0;
    for (const transaction of transactions) {
        transactionCount++;
        const txId = await getTxIdByTxHash(transaction.tx_hash);
        if (!txId)
            continue;
        const unixtime = await getUnixTimestampByTxId(txId);
        const cleanedTransfers = await getCleanedTransfersForTxIdFromTable(txId);
        if (!cleanedTransfers)
            continue;
        let from = transaction.transactionDetails.from;
        if (cleanedTransfers[0].to === '0x9008d19f58aabd9ed0d60971565aa8510560ab41') {
            from = cleanedTransfers[0].from;
        }
        const balanceChanges = await getBalanceChangeForAddressFromTransfers(from, cleanedTransfers);
        // Sort balanceChanges so sold token is first
        balanceChanges.sort((a, b) => b.balanceChange - a.balanceChange);
        if (balanceChanges.length === 2) {
            const soldToken = balanceChanges.find((change) => change.balanceChange < 0);
            const boughtToken = balanceChanges.find((change) => change.balanceChange > 0);
            if (!soldToken || !boughtToken)
                continue;
            const soldCoinId = await getCoinIdByAddress(soldToken.tokenAddress);
            const boughtCoinId = await getCoinIdByAddress(boughtToken.tokenAddress);
            const soldPrice = await getTokenPriceWithTimestampFromDb(soldCoinId, unixtime);
            const boughtPrice = await getTokenPriceWithTimestampFromDb(boughtCoinId, unixtime);
            // Use sold token's price if available; otherwise, use bought token's price.
            let price = soldPrice || boughtPrice;
            if (!price)
                continue; // Skip if neither price is available
            const swapDirection = `${soldToken.tokenSymbol} ➛ ${boughtToken.tokenSymbol}`;
            let dollarVolume = 0;
            if (soldPrice) {
                dollarVolume = Math.abs(soldToken.balanceChange) * soldPrice;
            }
            else if (boughtPrice) {
                dollarVolume = Math.abs(boughtToken.balanceChange) * boughtPrice;
            }
            if (!swapVolumes[swapDirection]) {
                swapVolumes[swapDirection] = { volume: 0, count: 0 };
            }
            swapVolumes[swapDirection].volume += dollarVolume;
            swapVolumes[swapDirection].count++;
        }
        if (transactionCount % 100 === 0) {
            console.log(`Processed ${transactionCount} transactions...`);
        }
    }
    // Sorting and outputting the results
    const sortedSwapVolumes = Object.entries(swapVolumes)
        .map(([direction, data]) => ({
        direction,
        volume: data.volume,
        count: data.count,
    }))
        .sort((a, b) => b.volume - a.volume);
    console.log('Sorted Swap Volumes:', sortedSwapVolumes);
}
/*

7 most recent big 1inch swaps which did usdc->usdt or usdt->usdc

1) 0xb114e2777b56fa11f645577231593c64b85fcad29a2ddfefb23e805b69fe47e7
2) 0xa2c14a0619bfc5a99c7da8d151a0059dee94ce28269f158eaa660d9b6a7ea0c6
3) 0x69026f8af02e1e346c920a62045e1bcf779b3fca53ab5eaaf75e6ef313098d40
4) 0xe0874ff92a689b3d072478202a3991c7053de3ebe1de3ba3f843ac71f953086d
5) 0x3318b9e48bd177ad44db381c2c3fd6b650da15e66ebaef546c6e502f7c17a315
6) 0x13868dd6bc47acdc4591f081facc29abbb5031ac247c6ead5de3ebe835ae05cb
7) 0xf8bfee01ce43d3914f5046a2642cf663977a15c4f1497d3c44d4bdaf9035f87a

was Curves 3Pool Involved?

1) yes
2) yes
3) yes
4) yes
5) yes
6) yes
7) yes

Swap Volume:

1) 5,999,990 USDT -> 5,999,612 USDC
2) 1,413,748 USDT -> 1,401,445 USDC
3) 6,011,249 USDC -> 6,010,835 USDT
4) 4,010,430 USDT -> 4,007,960 USDC
5) 4,009,990 USDT -> 4,007,634 USDC
6) 6,117,333 USDT -> 6,114,375 USDC
7) 4,009,990 USDT -> 4,008,602 USDC

What got swapped in Curves 3Pool ?

1) 2,807,995 USDT -> 2,807,705 DAI
2) 1,413,748 USDT -> 1,413,815 DAI
3) 3,246,074 USDC -> 3,245,733 USDT
4) 2,807,301 USDT -> 2,805,542 DAI
5) 2,566,393 USDT -> 2,564,845 USDC
6) 3,817,216 USDT -> 3,815,323 DAI
7) 1,860,635 USDT -> 1,859,858 DAI

Let us look at 3)
How many USDT do you get per USDC? You wants lots, high gud.

Curve:
3,246,074 USDC -> 3,245,733 USDT ===> Fee: 324 USDC
3245733 / 3246074 = 0.99989495002

DODO:
2,043,824 USDC -> 2,043,789 USDT
2043789 / 2043824 = 0.99998287523

PancakeV3Pool:
721,349 USDC -> 721,312 USDT
721312 / 721349 = 0.99994870721

3500000000000 -> 3499625450469
3499625 / 3500000 = 0.99989285714

6,011,249 -> 6,010,484
6010484 / 6011249 = 0.99987273859

0.99989495002 * 6,011,249 = 6,010,617

3Pool Fee: 0,01 %
Thats per Dollar of Volume: 0.01cent

**********************************************************
5) 0x3318b9e48bd177ad44db381c2c3fd6b650da15e66ebaef546c6e502f7c17a315

Now, let us look at 5)
Reminder: Swap was:
4009990 USDT -> 4007634 USDC

Curve 3Pool:
2566393 USDT -> 2564845 USDC
2564845 / 2566393 = per USDT sold 3Pool gave 0.999397 USDC
Fee: 256$
(2564845+256)/2566393 If Fee = 0 => per USDT sold 3Pool would have given 0.999496 USDC

Curve aDAI/aUSDC/aUSDT Pool:
962397 USDT -> 961857 USDC
961857 / 962397 = per USDT sold Pool gave 0.999439 USDC

PancakeV3Pool:
481198 USDT -> 480931 USDC
480931 / 481198 = per USDT sold Pancake gave 0.999445 USDC

-------<-<-<-<-<-<-<-y-y-y-y--<-<-y<-y-y-y<y-<y-<y-y<-y<-y-<

New Start with Volume-Range 90k$-100k$

1) 0x55f5af3284344765833618ba92665b4c5e1cb3e79b2f7c12038eded5248ed484
2) 0xe588cc1a6b2e67650a61bc350697defde4f446213d5cd8ddc3fdfb17fcc3cf09
3) 0xffb6cc857ddebcb563da76607756e9672e2192b15272ed948875d94264def4ce (kinda, still has a relevant swap there)

3)
Uniswap V3: USDC-USDT 4 (0x3416cF6C708Da44DB2624D63ea0AAef7113527C6)
swapped 97,006.61 USDC into 97,071.95 USDT [Gas: 73363]

if 3Pool: 3Pool gave out 97,068.741009 USDT [Gas: about 108719]:

2)
Uniswap V3: USDC-USDT 4 (0x3416cF6C708Da44DB2624D63ea0AAef7113527C6)
swapped 99,845.536473 USDC into 99,894.017251 USDT [Gas: 72419]


if 3Pool: 3Pool gave out 99,893.304162 USDT [Gas: about 108719]:
0.01% Fee => 9.9893$
GasFee Increase = 3.057$
Uniswap gave 0.7130$ more out.
Curve has to give out X to break even gas wise: X = 99,894.017251 + 3.057 = 99,897.074251
Curve had to give out Y more than it did to break even gas wise: 99,897.074251 - 99,893.304162 = 3.77$
It could have achieved net break even with Fee = 3.77$, thats Fee % = 0.00377.
So Fee from 0.01% to 0.00377% = break even.
Lets check which fee makes curve net better by 0.713$:
Fee = 3.77-0.713 = 3.057$. That's Fee = 0.003057%

108719-72419

3)
Uniswap V3: USDC-USDT 4 (0x3416cF6C708Da44DB2624D63ea0AAef7113527C6)
swapped 95,583.250000 USDC into 95,569.981167 USDT [Gas: dunno]


if 3Pool: 3Pool gave out 95,563.561534 USDT [Gas: about 108719]:




*/
async function get1inchRawEvents() {
    const _1InchV5 = '0x1111111254EEB25477B68fb85Ed929f73A960582';
    const _1InchV6 = '0x111111125421cA6dc452d289314280a0f8842A65';
    const contract = new WEB3_HTTP_PROVIDER.eth.Contract(getInchv5Abi(), _1InchV5);
    const fullBlockRange = { start: 19542002, end: 19605199 };
    let PAST_EVENTS = [];
    while (true) {
        try {
            for (let fromBlock = fullBlockRange.start; fromBlock < fullBlockRange.end; fromBlock += 5000) {
                const toBlock = Math.min(fromBlock + 4999, fullBlockRange.end);
                const events = await retry(() => getPastEvents(contract, 'allEvents', fromBlock, toBlock));
                if (Array.isArray(events)) {
                    PAST_EVENTS = PAST_EVENTS.concat(events);
                }
                else {
                    throw new Error('Events not retrieved');
                }
            }
            break;
        }
        catch (error) {
            console.log('Trying with recommended block range...');
            try {
                if (error instanceof Error && 'recommendedBlockRange' in error) {
                    const recommendedBlockRange = error.recommendedBlockRange;
                    if (recommendedBlockRange &&
                        typeof recommendedBlockRange === 'object' &&
                        'start' in recommendedBlockRange &&
                        'end' in recommendedBlockRange) {
                        for (let fromBlock = recommendedBlockRange.start; fromBlock < recommendedBlockRange.end; fromBlock += 5000) {
                            const toBlock = Math.min(fromBlock + 4999, recommendedBlockRange.end);
                            const events = await retry(() => getPastEvents(contract, 'allEvents', fromBlock, toBlock));
                            if (Array.isArray(events)) {
                                PAST_EVENTS = PAST_EVENTS.concat(events);
                            }
                            else {
                                throw new Error('Events not retrieved');
                            }
                        }
                    }
                    else {
                        throw new Error('Invalid recommended block range');
                    }
                }
                else {
                    throw error;
                }
                break;
            }
            catch (error) {
                console.log('Retrying with full block range...');
            }
        }
    }
    return PAST_EVENTS;
}
async function getTxHashesAndBlockNumbersFrom1InchEvents() {
    const rawEvents = await get1inchRawEvents();
    const txHashesAndBlockNumbers = rawEvents.map((event) => ({
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
    }));
    return Array.from(new Set(txHashesAndBlockNumbers));
}
async function getJsonFor1Inch() {
    // const path = '../v5fromEtherscan.csv';
    const path = '../v6fromEtherscan.csv';
    const _1InchV5 = '0x1111111254EEB25477B68fb85Ed929f73A960582';
    const _1InchV6 = '0x111111125421cA6dc452d289314280a0f8842A65';
    const ethersanJSON = await getJsonParsedEtherscanCsv(path);
    console.log(ethersanJSON);
    console.log(`there are ${ethersanJSON.length} rows in the list`);
    const txHashesAndBlockNumbers = ethersanJSON.map((row) => ({
        txHash: row.Txhash,
        blockNumber: row.Blockno,
    }));
    const data = [];
    const totalTxHashes = txHashesAndBlockNumbers.length;
    let processedTxHashes = 0;
    for (const { txHash, blockNumber } of txHashesAndBlockNumbers) {
        console.log(`Processing txHash ${++processedTxHashes} of ${totalTxHashes}: ${txHash}`);
        const cleanedTransfers = await getCleanedTransfersFor1inch(txHash, _1InchV6);
        if (!cleanedTransfers)
            continue;
        data.push({ txHash, blockNumber, cleanedTransfers });
    }
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync('v6fromEtherscanCleanTransfers.json', jsonData);
    console.log(`Saved txHashes and blockNumbers to v6fromEtherscanCleanTransfers.json`);
}
async function getJsonParsedEtherscanCsv(csvFilePath) {
    const fileContent = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
    return new Promise((resolve, reject) => {
        parse(fileContent, { columns: true }, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}
async function workWith16hourskOf1InchData() {
    // const list = get1InchV6ListCompleteWithCleanedTransfers();
    // const _3PoolAddress = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7';
    // const uniV3UsdcUsdtPoolAddress = '0x3416cf6c708da44db2624d63ea0aaef7113527c6';
    // const filteredSwaps = filterSwaps(list, _3PoolAddress, uniV3UsdcUsdtPoolAddress);
    // const formattedSwaps = formatSwaps(filteredSwaps);
    // console.log(`there are ${formattedSwaps.length} formatted swaps`);
    // const jsonData = JSON.stringify(formattedSwaps, null, 2);
    // fs.writeFileSync('v6Swaps.json', jsonData);
    // console.log(`Saved File`);
}
function formatSwaps(uniqueSwaps) {
    const _3PoolAddress = '0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7';
    const uniV3UsdcUsdtPoolAddress = '0x3416cf6c708da44db2624d63ea0aaef7113527c6';
    return uniqueSwaps.map((uniqueSwap) => {
        const { txHash, blockNumber: blockNumberString, filteredDirectSwaps } = uniqueSwap;
        const blockNumber = parseInt(blockNumberString, 10);
        const [transfer1, transfer2] = filteredDirectSwaps[0];
        let pool = '';
        let swappedAt3Pool = 0;
        let swappedAtUniswapV3 = 0;
        if (transfer1.from === _3PoolAddress ||
            transfer1.to === _3PoolAddress ||
            transfer2.from === _3PoolAddress ||
            transfer2.to === _3PoolAddress) {
            if (transfer1.from === uniV3UsdcUsdtPoolAddress ||
                transfer1.to === uniV3UsdcUsdtPoolAddress ||
                transfer2.from === uniV3UsdcUsdtPoolAddress ||
                transfer2.to === uniV3UsdcUsdtPoolAddress) {
                pool = 'both';
                swappedAt3Pool = transfer1.parsedAmount;
                swappedAtUniswapV3 = transfer2.parsedAmount;
            }
            else {
                pool = '3Pool';
                swappedAt3Pool = transfer1.parsedAmount;
            }
        }
        else if (transfer1.from === uniV3UsdcUsdtPoolAddress ||
            transfer1.to === uniV3UsdcUsdtPoolAddress ||
            transfer2.from === uniV3UsdcUsdtPoolAddress ||
            transfer2.to === uniV3UsdcUsdtPoolAddress) {
            pool = 'UniswapV3';
            swappedAtUniswapV3 = transfer1.parsedAmount;
        }
        const swap = `${transfer1.parsedAmount} ${transfer1.tokenSymbol} => ${transfer2.parsedAmount} ${transfer2.tokenSymbol}`;
        return {
            pool,
            swap,
            txHash,
            blockNumber,
            soldTokenSymbol: transfer1.tokenSymbol,
            userAmountSold: transfer1.parsedAmount,
            boughtTokenSymbol: transfer2.tokenSymbol,
            userAmountReceived: transfer2.parsedAmount,
            swappedAt3Pool,
            swappedAtUniswapV3,
        };
    });
}
function removeDuplicateSwaps(filteredSwaps) {
    const uniqueSwaps = [];
    const seenTxHashes = new Set();
    for (const swap of filteredSwaps) {
        if (!seenTxHashes.has(swap.txHash)) {
            uniqueSwaps.push(swap);
            seenTxHashes.add(swap.txHash);
        }
    }
    return uniqueSwaps;
}
function filterSwaps(list, _3PoolAddress, uniV3UsdcUsdtPoolAddress) {
    const filteredSwaps = [];
    for (let i = 0; i < list.length; i++) {
        let entry = list[i];
        let txHash = entry.txHash;
        let blockNumber = entry.blockNumber;
        let cleanedTransfers = entry.cleanedTransfers;
        let directSwaps = getDirectSwaps(cleanedTransfers);
        const filteredDirectSwaps = directSwaps.filter((swap) => {
            return (swap[0].from === _3PoolAddress ||
                swap[0].to === _3PoolAddress ||
                swap[0].from === uniV3UsdcUsdtPoolAddress ||
                swap[0].to === uniV3UsdcUsdtPoolAddress ||
                swap[1].from === _3PoolAddress ||
                swap[1].to === _3PoolAddress ||
                swap[1].from === uniV3UsdcUsdtPoolAddress ||
                swap[1].to === uniV3UsdcUsdtPoolAddress);
        });
        if (filteredDirectSwaps.length > 0) {
            filteredSwaps.push({ txHash, blockNumber, filteredDirectSwaps });
        }
    }
    return filteredSwaps;
}
function getDirectSwaps(cleanedTransfers) {
    const allowedSwaps = [
        { from: 'USDC', to: 'USDT' },
        { from: 'USDT', to: 'USDC' },
        { from: 'USDC', to: 'DAI' },
        { from: 'DAI', to: 'USDC' },
        { from: 'DAI', to: 'USDT' },
        { from: 'USDT', to: 'DAI' },
    ];
    const swaps = [];
    for (let i = 0; i < cleanedTransfers.length - 1; i++) {
        const transfer1 = cleanedTransfers[i];
        const transfer2 = cleanedTransfers[i + 1];
        if (allowedSwaps.some((swap) => transfer1.tokenSymbol === swap.from &&
            transfer2.tokenSymbol === swap.to &&
            transfer1.to === transfer2.from &&
            transfer1.from === transfer2.to)) {
            swaps.push([transfer1, transfer2]);
        }
    }
    return swaps;
}
export async function oneInchVolThings() {
    // await getJsonFor1Inch();
    await workWith16hourskOf1InchData();
}
//# sourceMappingURL=oneInch.js.map