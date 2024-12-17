import { getCalledContractOnChain, WEB3_HTTP_PROVIDER } from '../../../../../web3Calls/generic.js';
import { getBlockTransactionDetails } from '../../../../sandwiches/GoodSandwiches.js';
import { getErc20Contract } from '../../../../utils/Contracts.js';
import { getUniswapV2Contract } from '../ContractGetter.js';
import fs from 'fs';
function reverseSwapDirection(swapDirection) {
    const [input, output] = swapDirection.split('->');
    return `${output}->${input}`;
}
function normalizeAddress(address) {
    return address.trim().toLowerCase();
}
function findSandwiches(events) {
    // Group events by blockNumber
    const groupedByBlock = {};
    events.forEach((event) => {
        if (!groupedByBlock[event.blockNumber]) {
            groupedByBlock[event.blockNumber] = [];
        }
        groupedByBlock[event.blockNumber].push(event);
    });
    const sandwiches = [];
    // Process each block separately
    Object.keys(groupedByBlock).forEach((blockNumberStr) => {
        const blockNumber = parseInt(blockNumberStr);
        const blockEvents = groupedByBlock[blockNumber];
        // Sort events by position
        blockEvents.sort((a, b) => a.position - b.position);
        const N = blockEvents.length;
        // Iterate over events to find potential sandwiches
        for (let i = 0; i < N; i++) {
            const frontrun = blockEvents[i];
            const frontrunUser = normalizeAddress(frontrun.user);
            const frontrunSwapDirection = `${frontrun.inputTokenId}->${frontrun.outputTokenId}`;
            const reverseSwapDir = reverseSwapDirection(frontrunSwapDirection);
            let victimTxs = [];
            let backrun = null;
            // Scan subsequent transactions for victim transactions and backrun
            for (let j = i + 1; j < N; j++) {
                const tx = blockEvents[j];
                const txUser = normalizeAddress(tx.user);
                const txSwapDirection = `${tx.inputTokenId}->${tx.outputTokenId}`;
                if (txUser === frontrunUser && txSwapDirection === reverseSwapDir) {
                    // Found backrun transaction
                    backrun = tx;
                    break;
                }
                else if (txUser !== frontrunUser && txSwapDirection === frontrunSwapDirection) {
                    // Found victim transaction
                    victimTxs.push(tx);
                }
                else {
                    // Ignore other transactions (allow gaps)
                    continue;
                }
            }
            // Check if we have a valid sandwich
            if (backrun && victimTxs.length >= 1) {
                const sequence = [frontrun, ...victimTxs, backrun];
                sandwiches.push({
                    blockNumber: blockNumber,
                    sequence: sequence,
                });
            }
        }
    });
    return sandwiches;
}
// Function to determine swap direction and calculate amounts
function formatEvents(events, poolInfo) {
    return events.map((event) => {
        const soldToken = Number(event.returnValues.amount1In) > 0 ? poolInfo.token1.name : poolInfo.token0.name;
        const boughtToken = soldToken === poolInfo.token1.name ? poolInfo.token0.name : poolInfo.token1.name;
        let parsedToken0Amount = 0;
        let parsedToken1Amount = 0;
        if (soldToken === poolInfo.token0.name) {
            parsedToken1Amount = Math.abs(Number(event.returnValues.amount1Out) / 10 ** poolInfo.token1.decimals);
            parsedToken0Amount = Math.abs(Number(event.returnValues.amount0In) / 10 ** poolInfo.token0.decimals);
        }
        else {
            parsedToken1Amount = Math.abs(Number(event.returnValues.amount1In) / 10 ** poolInfo.token1.decimals);
            parsedToken0Amount = Math.abs(Number(event.returnValues.amount0Out) / 10 ** poolInfo.token0.decimals);
        }
        const formattedSoldAmount = soldToken === poolInfo.token1.name ? parsedToken1Amount : parsedToken0Amount;
        const formattedBoughtAmount = soldToken === poolInfo.token1.name ? parsedToken0Amount : parsedToken1Amount;
        const inputTokenId = soldToken === poolInfo.token1.name ? 'token1' : 'token0';
        const outputTokenId = inputTokenId === 'token0' ? 'token1' : 'token0';
        const swapDirection = soldToken === poolInfo.token1.name
            ? `${poolInfo.token1.name} -> ${poolInfo.token0.name}`
            : `${poolInfo.token0.name} -> ${poolInfo.token1.name}`;
        return {
            txHash: event.transactionHash,
            blockNumber: event.blockNumber,
            position: event.transactionIndex,
            unixTime: parseInt(event.blockTimestamp, 16),
            sold: soldToken,
            bought: boughtToken,
            swap: swapDirection,
            inputTokenId: inputTokenId,
            outputTokenId: outputTokenId,
            soldAmount: formattedSoldAmount,
            boughtAmount: formattedBoughtAmount,
            user: event.returnValues.sender,
        };
    });
}
async function getSwapEvents(allEvents) {
    // Filter events to only include those with the event name 'Swap'
    const swapEvents = allEvents
        .filter((event) => event.event === 'Swap')
        .map((event) => {
        return {
            address: event.address,
            blockHash: event.blockHash,
            blockNumber: event.blockNumber,
            blockTimestamp: event.blockTimestamp,
            transactionHash: event.transactionHash,
            transactionIndex: event.transactionIndex,
            logIndex: event.logIndex,
            removed: event.removed,
            id: event.id,
            returnValues: {
                '0': event.returnValues['0'],
                '1': event.returnValues['1'],
                '2': event.returnValues['2'],
                '3': event.returnValues['3'],
                sender: event.returnValues.sender,
                amount0In: event.returnValues.amount0In,
                amount1In: event.returnValues.amount1In,
                amount0Out: event.returnValues.amount0Out,
                amount1Out: event.returnValues.amount1Out,
                to: event.returnValues.to,
            },
            event: event.event,
            signature: event.signature,
            raw: {
                data: event.raw.data,
                topics: event.raw.topics,
            },
        };
    });
    return swapEvents;
}
async function getEvents(poolAddress, blockNumber) {
    const poolContract = getUniswapV2Contract(poolAddress);
    const blocksPerMinute = 5;
    // const minutes = 60 * 24 * 7 * 26;
    const minutes = 60 * 24 * 7 * 3;
    // const minutes = 60 * 24 * 7;
    let toBlock = 20927992;
    let fromBlock = toBlock - blocksPerMinute * minutes;
    if (blockNumber) {
        toBlock = blockNumber;
        fromBlock = blockNumber;
    }
    const swapEvents = await poolContract.getPastEvents('allEvents', { fromBlock, toBlock });
    return swapEvents;
}
async function getExtendedGasInfo(blockNumber, position) {
    try {
        const transaction = await getBlockTransactionDetails(blockNumber, position);
        return transaction.gasPrice;
    }
    catch (err) {
        console.log('gas failed');
        return null;
    }
}
function filterProbSammichWithAtLeast1MatchingTx(sandwiches, formattedEvents) {
    return sandwiches
        .map((sandwich) => {
        const blockNumber = sandwich.blockNumber;
        const formattedEventsForBlock = formattedEvents.filter((event) => event.blockNumber === blockNumber);
        const sequence = sandwich.sequence;
        if (sequence.length < 3)
            return null; // Need at least 3 transactions
        const frontrun = sequence[0];
        const backrun = sequence[sequence.length - 1];
        const centerTxs = sequence.slice(1, -1);
        if (centerTxs.length === 0)
            return null; // No center transactions (victims)
        // For simplicity, we'll consider the first center transaction as the victim
        const victimTx = centerTxs[0];
        const victimSwapDirection = `${victimTx.inputTokenId}->${victimTx.outputTokenId}`;
        // Count the number of transactions in the block with the same swap direction as the victim
        const sameDirectionCount = formattedEventsForBlock.filter((tx) => {
            const txSwapDirection = `${tx.inputTokenId}->${tx.outputTokenId}`;
            return txSwapDirection === victimSwapDirection;
        }).length;
        // If there are at least 4 such transactions, consider it a probable sandwich
        if (sameDirectionCount >= 4) {
            const otherTxHashes = formattedEventsForBlock
                .filter((event) => {
                const txSwapDirection = `${event.inputTokenId}->${event.outputTokenId}`;
                return (txSwapDirection === victimSwapDirection &&
                    ![frontrun.txHash, backrun.txHash, victimTx.txHash].includes(event.txHash));
            })
                .map((event) => event.txHash);
            return {
                blockNumber: blockNumber,
                victimTxHash: victimTx.txHash,
                otherTxHashes: otherTxHashes,
            };
        }
        return null;
    })
        .filter((result) => result !== null);
}
async function addGasInfoToSandwiches(probSammichWithAtLeast1MatchingTx, formattedEvents) {
    const concurrencyLimit = 10;
    const results = [];
    for (let i = 0; i < probSammichWithAtLeast1MatchingTx.length; i += concurrencyLimit) {
        const chunk = probSammichWithAtLeast1MatchingTx.slice(i, i + concurrencyLimit);
        const chunkResults = await Promise.all(chunk.map(async (sandwich) => {
            // Find the victim transaction in formattedEvents to get the correct position
            const victimEvent = formattedEvents.find((event) => event.txHash === sandwich.victimTxHash && event.blockNumber === sandwich.blockNumber);
            // Fetch gas info for the victim transaction using the correct position
            const victimGasInfo = victimEvent
                ? await getExtendedGasInfo(victimEvent.blockNumber, victimEvent.position)
                : null;
            // Fetch gas info for all other transactions
            const othersWithGasInfo = [];
            for (let j = 0; j < sandwich.otherTxHashes.length; j += concurrencyLimit) {
                const txHashChunk = sandwich.otherTxHashes.slice(j, j + concurrencyLimit);
                const txChunkResults = await Promise.all(txHashChunk.map(async (txHash) => {
                    // Find the event for the other transaction to get the correct position
                    const otherEvent = formattedEvents.find((event) => event.txHash === txHash && event.blockNumber === sandwich.blockNumber);
                    // Fetch gas info using the correct position
                    const otherTxGasInfo = otherEvent
                        ? await getExtendedGasInfo(otherEvent.blockNumber, otherEvent.position)
                        : null;
                    return {
                        txHash,
                        gasPrice: otherTxGasInfo,
                        position: otherEvent ? otherEvent.position : null, // Add position for other transactions
                    };
                }));
                othersWithGasInfo.push(...txChunkResults);
            }
            return {
                blockNumber: sandwich.blockNumber,
                victim: {
                    txHash: sandwich.victimTxHash,
                    gasPrice: victimGasInfo,
                    position: victimEvent ? victimEvent.position : null, // Add position for victim transaction
                },
                others: othersWithGasInfo,
            };
        }));
        results.push(...chunkResults);
    }
    return results;
}
export function filterSandwichesByPositionAndGas(probSammichWithAtLeast1MatchingTxAndGas) {
    return probSammichWithAtLeast1MatchingTxAndGas.filter((sandwich) => {
        // Get victim's position and gas price
        const victimPosition = sandwich.victim.position;
        const victimGasPrice = sandwich.victim.gasPrice ? parseFloat(sandwich.victim.gasPrice) : null;
        // Filter "others" based on the condition
        const hasValidOtherTx = sandwich.others.some((other) => {
            const otherPosition = other.position;
            const otherGasPrice = other.gasPrice ? parseFloat(other.gasPrice) : null;
            // Check if position and gas price conditions are met
            return (victimPosition !== null &&
                otherPosition !== null &&
                otherPosition > victimPosition &&
                victimGasPrice !== null &&
                otherGasPrice !== null &&
                otherGasPrice > victimGasPrice);
        });
        // Keep the sandwich if the condition is met
        return hasValidOtherTx;
    });
}
async function getPoolBalanceAtBlock(poolAddress, poolInfo, blockNumber) {
    const poolContract = getUniswapV2Contract(poolAddress);
    // Fetch the reserves from the pool contract at the specified block number
    const balances = await poolContract.methods.getReserves().call(blockNumber);
    // console.log('balances', balances);
    // Convert the balances based on the token decimals
    const token0Amount = balances[0] / 10 ** poolInfo.token0.decimals;
    const token1Amount = balances[1] / 10 ** poolInfo.token1.decimals;
    // Return both token amounts
    return {
        token0Amount,
        token1Amount,
    };
}
async function loadUniswapV2Pool(poolAddress) {
    const contract = getUniswapV2Contract(poolAddress);
    // Fetch token0 details
    const token0Address = await contract.methods.token0().call();
    const token0 = await getErc20Contract(token0Address);
    const token0Symbol = await token0.methods.symbol().call();
    const token0Name = await token0.methods.name().call();
    const token0Decimals = await token0.methods.decimals().call();
    // Fetch token1 details
    const token1Address = await contract.methods.token1().call();
    const token1 = await getErc20Contract(token1Address);
    const token1Symbol = await token1.methods.symbol().call();
    const token1Name = await token1.methods.name().call();
    const token1Decimals = await token1.methods.decimals().call();
    // Return the token info
    return {
        token0: {
            address: token0Address,
            symbol: token0Symbol,
            name: token0Name,
            decimals: token0Decimals,
        },
        token1: {
            address: token1Address,
            symbol: token1Symbol,
            name: token1Name,
            decimals: token1Decimals,
        },
    };
}
function calculateXYKSwap(inputAmount, inputReserve, outputReserve) {
    const feePercentage = 0.003; // Hardcoded fee of 0.3%
    // Adjust the input amount for the fee
    const adjustedInputAmount = inputAmount * (1 - feePercentage);
    // Calculate the output amount using the XYK formula
    const outputAmount = (adjustedInputAmount * outputReserve) / (inputReserve + adjustedInputAmount);
    // Ensure the output amount is positive and not zero
    if (outputAmount <= 0) {
        throw new Error('Output amount must be greater than zero.');
    }
    // Calculate the new reserves after the swap
    const newToken0Reserve = inputReserve + adjustedInputAmount;
    const newToken1Reserve = outputReserve - outputAmount;
    // Ensure that reserves do not go negative
    if (newToken1Reserve < 0) {
        throw new Error('Insufficient liquidity: output reserve cannot be negative.');
    }
    return {
        outputAmount,
        newToken0Reserve,
        newToken1Reserve,
    };
}
async function addMissingTxHashes(filteredResults, formattedEvents) {
    return Promise.all(filteredResults.map(async (result) => {
        const blockNumberInt = result.blockNumber;
        // Extract existing txHashes from the filtered results, including the victim's txHash
        const existingTxHashes = new Set([result.victim.txHash, ...result.others.map((other) => other.txHash)]);
        // Find all events in the same block that are not already included
        const missingTransactions = formattedEvents.filter((event) => event.blockNumber === blockNumberInt && !existingTxHashes.has(event.txHash) // Exclude already included transactions
        );
        // Fetch gas info for all missing transactions
        const missingTxWithGasInfo = await Promise.all(missingTransactions.map(async (missingEvent) => {
            const gasInfo = await getExtendedGasInfo(missingEvent.blockNumber, missingEvent.position);
            return {
                txHash: missingEvent.txHash,
                gasPrice: gasInfo,
                position: missingEvent.position, // Add position for missing transactions
            };
        }));
        // Return the result including the new missing transactions
        return {
            blockNumber: result.blockNumber,
            victim: result.victim,
            others: [...result.others, ...missingTxWithGasInfo], // Combine existing and new others
        };
    }));
}
function parseInput(input) {
    // We assume the `min_out` value is at bytes 132-144 (characters 264-288 in hex string).
    const minOutHex = input.slice(255, 266);
    const minOutValue = parseInt(minOutHex, 16); // Convert to integer from hex
    return minOutValue.toString();
}
function handleVictimTrace(victimTrace) {
    if (victimTrace.length === 0) {
        console.log('No trace data available.');
        return;
    }
    const firstTrace = victimTrace[0];
    const toAddress = firstTrace.action.to.toLowerCase();
    let minOutValue = '0';
    if (toAddress === '0x4313c378cc91ea583c91387b9216e2c03096b27f') {
        const input = firstTrace.action.input;
        minOutValue = parseInput(input);
    }
    else {
        const input = firstTrace.action.input;
        const targetHex = input.slice(127, 138);
        const targetValue = parseInt(targetHex, 16);
        minOutValue = targetValue.toString();
    }
    return minOutValue;
}
async function processVictimTransaction(result, formattedEvents, poolAddress, poolInfo) {
    // Fetch the pool balances at the block before the victim's transaction
    const poolBalances = await getPoolBalanceAtBlock(poolAddress, poolInfo, result.blockNumber - 1);
    // if (result.blockNumber !== 19728568) return;
    const victimPosition = result.victim.position;
    if (victimPosition === null || victimPosition === undefined)
        return;
    // console.log('victimPosition', victimPosition);
    // console.log('Result is all swaps in that block, with the victim tx listed separately.');
    //  console.dir(result, { depth: null, colors: true });
    // Filter out the transactions at the victim's position, one before and one after
    const swapsWithoutBot = result.others.filter((other) => other.position !== victimPosition - 1 &&
        other.position !== victimPosition &&
        other.position !== victimPosition + 1);
    // console.log('swapsWithoutBot are also without the victim, that gets added later in the code:');
    // console.dir(swapsWithoutBot, { depth: null, colors: true });
    const victimSwap = {
        txHash: result.victim.txHash,
        gasPrice: result.victim.gasPrice,
        position: victimPosition,
    };
    // Combine the swaps without bot and the victim swap
    const combinedSwaps = [...swapsWithoutBot, victimSwap];
    // console.dir(combinedSwaps, { depth: null, colors: true });
    // Sort combined transactions by gas price (high to low)
    let sortedSwaps = combinedSwaps
        .filter((swap) => swap.gasPrice !== null)
        .sort((a, b) => parseFloat(b.gasPrice) - parseFloat(a.gasPrice));
    // console.dir(sortedSwaps, { depth: null, colors: true });
    // console.dir(sortedSwaps, { depth: null, colors: true });
    const victimTxHash = result.victim.txHash;
    let victimSimAmountOut = 0;
    let victimAssetNameBought = '';
    let token0Reserve = poolBalances.token0Amount;
    let token1Reserve = poolBalances.token1Amount;
    // Process each sorted swap
    for (const swap of sortedSwaps) {
        const formattedSwap = formattedEvents.find((event) => event.txHash === swap.txHash);
        if (!formattedSwap)
            continue;
        // console.log(formattedSwap);
        const inputAmount = formattedSwap.soldAmount;
        const inputTokenId = formattedSwap.inputTokenId;
        const outputTokenId = formattedSwap.outputTokenId;
        const inputReserve = inputTokenId === 'token0' ? token0Reserve : token1Reserve;
        const outputReserve = outputTokenId === 'token0' ? token0Reserve : token1Reserve;
        // Calculate the result of the swap
        const swapResult = calculateXYKSwap(inputAmount, inputReserve, outputReserve);
        if (victimTxHash === swap.txHash) {
            victimSimAmountOut = swapResult.outputAmount;
            victimAssetNameBought = formattedSwap.bought;
        }
        // Update the reserves after the swap
        if (inputTokenId === 'token0') {
            token0Reserve = swapResult.newToken0Reserve;
            token1Reserve = swapResult.newToken1Reserve;
        }
        else {
            token0Reserve = swapResult.newToken1Reserve;
            token1Reserve = swapResult.newToken0Reserve;
        }
    }
    // Calculate the victim's actual output amount
    const formattedEvent = formattedEvents.find((event) => event.txHash === victimTxHash);
    const actualOutputAmount = formattedEvent ? formattedEvent.boughtAmount : 0;
    const difference = actualOutputAmount - victimSimAmountOut;
    if (difference < 0) {
        negativeCounter++;
        // console.log(`Victim lost ${Math.abs(difference)} ${victimAssetNameBought} due to sandwich.`);
    }
    else {
        // Print the results
        // positiveCounter++;
        numberSandwichGotVictimTxMined++;
        console.log('');
        console.log('victimTxHash', victimTxHash);
        console.log('actualOutputAmount', actualOutputAmount);
        console.log('victimSimAmountOut', victimSimAmountOut);
        return {
            victimTxHash: victimTxHash,
            actualOutputAmount: actualOutputAmount,
            victimSimAmountOut: victimSimAmountOut,
            amountOutMin: 999999999999999,
        };
        // console.log('amountOutMin', amountOutMin);
        // console.log(`Victim gained ${difference} ${victimAssetNameBought} due to sandwich.`);
    }
    // console.log('bad:', negativeCounter, 'good:', positiveCounter);
}
let negativeCounter = 0;
let positiveCounter = 0;
function extractSandwiches(groupsWithDoubledUser) {
    const sandwiches = [];
    for (const group of groupsWithDoubledUser) {
        const { blockNumber, sequence } = group;
        // Group events by user to find those with multiple entries
        const userPositions = {};
        sequence.forEach((event) => {
            if (!userPositions[event.user]) {
                userPositions[event.user] = [];
            }
            userPositions[event.user].push(event);
        });
        // Identify sandwiches where a user has exactly two transactions (frontrun and backrun)
        for (const [user, events] of Object.entries(userPositions)) {
            if (events.length < 2)
                continue; // We need at least two transactions for a sandwich
            // Sort by position to identify frontrun and backrun
            const sortedEvents = events.sort((a, b) => a.position - b.position);
            const frontrun = Object.assign(Object.assign({}, sortedEvents[0]), { label: 'frontrun' });
            const backrun = Object.assign(Object.assign({}, sortedEvents[sortedEvents.length - 1]), { label: 'backrun' });
            // Extract center transactions within the frontrun and backrun positions
            const center = sequence
                .filter((event) => event.position > frontrun.position && event.position < backrun.position)
                .map((event) => (Object.assign(Object.assign({}, event), { label: 'center' })));
            // Only consider it a valid sandwich if there is at least one center transaction
            if (center.length > 0) {
                sandwiches.push({
                    blockNumber,
                    frontrun,
                    center,
                    backrun,
                });
            }
        }
    }
    return sandwiches;
}
async function addGasInfoToSandwichesFull(sandwiches, formattedEvents) {
    const concurrencyLimit = 10;
    const results = [];
    for (let i = 0; i < sandwiches.length; i += concurrencyLimit) {
        const chunk = sandwiches.slice(i, i + concurrencyLimit);
        const chunkResults = await Promise.all(chunk.map(async (sandwich) => {
            // Get gas info for the frontrun transaction
            const frontrunEvent = formattedEvents.find((event) => event.txHash === sandwich.frontrun.txHash && event.blockNumber === sandwich.blockNumber);
            const frontrunGasInfo = frontrunEvent
                ? await getExtendedGasInfoFull(frontrunEvent.blockNumber, frontrunEvent.position)
                : null;
            const frontrun = Object.assign(Object.assign({}, sandwich.frontrun), { label: 'frontrun', gasInfo: frontrunGasInfo });
            // Get gas info for the backrun transaction
            const backrunEvent = formattedEvents.find((event) => event.txHash === sandwich.backrun.txHash && event.blockNumber === sandwich.blockNumber);
            const backrunGasInfo = backrunEvent
                ? await getExtendedGasInfoFull(backrunEvent.blockNumber, backrunEvent.position)
                : null;
            const backrun = Object.assign(Object.assign({}, sandwich.backrun), { label: 'backrun', gasInfo: backrunGasInfo });
            // Get gas info for all center transactions
            const centerEvents = Array.isArray(sandwich.center) ? sandwich.center : [sandwich.center];
            const centerWithGasInfo = await Promise.all(centerEvents.map(async (centerEvent) => {
                const event = formattedEvents.find((e) => e.txHash === centerEvent.txHash && e.blockNumber === sandwich.blockNumber);
                const gasInfo = event ? await getExtendedGasInfoFull(event.blockNumber, event.position) : null;
                return Object.assign(Object.assign({}, centerEvent), { label: 'center', gasInfo });
            }));
            return {
                blockNumber: sandwich.blockNumber,
                frontrun,
                center: centerWithGasInfo,
                backrun,
            };
        }));
        results.push(...chunkResults);
    }
    return results;
}
async function getExtendedGasInfoFull(blockNumber, position) {
    try {
        const transaction = await getBlockTransactionDetails(blockNumber, position);
        return {
            gasLimit: transaction.gas,
            gasPrice: transaction.gasPrice,
            maxFeePerGas: transaction.maxFeePerGas,
            maxPriorityFeePerGas: transaction.maxPriorityFeePerGas,
        };
    }
    catch (err) {
        console.log(`Failed to retrieve gas info for block ${blockNumber}, position ${position}: ${err}`);
        return null;
    }
}
async function filterFullSetByAllowedAddresses(allowedAddresses, fullSet) {
    const filteredFullSet = [];
    for (const element of fullSet) {
        const victimToAddress = await getCalledContractOnChain(element.victim.txHash);
        if (victimToAddress && allowedAddresses.has(victimToAddress)) {
            // console.log('victimToAddress', victimToAddress);
            filteredFullSet.push(element);
        }
    }
    return filteredFullSet;
}
async function transformAndSaveData() {
    const data = JSON.parse(fs.readFileSync('sandwichDataUniswapV2.json', 'utf-8'));
    const result = [];
    console.log(`Starting transformation of ${data.length} pools`);
    // Process each pool and extract relevant data
    for (let poolIndex = 0; poolIndex < data.length; poolIndex++) {
        const pool = data[poolIndex];
        console.log(`Processing pool ${poolIndex + 1}/${data.length} - Pool Address: ${pool.poolAddress}`);
        for (let sandwichIndex = 0; sandwichIndex < pool.sandwichData.length; sandwichIndex++) {
            const sandwich = pool.sandwichData[sandwichIndex];
            console.log(`  Processing sandwich ${sandwichIndex + 1}/${pool.sandwichData.length} in pool ${pool.poolAddress}`);
            for (const tx of sandwich) {
                if (tx.label === 'center') {
                    const toAddress = await getCalledContractOnChain(tx.txHash); // Get the `to` address
                    // Only add the transaction if `to` is in the allowed set
                    if (toAddress && allowedAddresses.has(toAddress.toLowerCase())) {
                        result.push({
                            to: toAddress,
                            victimTxHash: tx.txHash,
                            actualOutputAmount: tx.boughtAmount,
                        });
                    }
                }
            }
        }
    }
    console.log(`Transformation complete. Processed ${result.length} center transactions matching allowed addresses.`);
    // Save the transformed data to a new JSON file
    fs.writeFileSync('filteredSandwichDataUniswapV2.json', JSON.stringify(result, null, 2), 'utf-8');
    console.log('Data saved to filteredSandwichDataUniswapV2.json');
}
const allowedAddresses = new Set([
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'.toLowerCase(),
    '0x4313C378Cc91eA583C91387B9216e2c03096b27f'.toLowerCase(),
]);
async function fetchCallData(txHash) {
    try {
        const transaction = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash);
        return transaction ? transaction.input : null;
    }
    catch (error) {
        console.error(`Error fetching call data for txHash: ${txHash}`, error);
        return null;
    }
}
// @ts-ignore
import abiDecoder from 'abi-decoder';
async function processTransactionsAndSave() {
    const filteredData = JSON.parse(fs.readFileSync('filteredSandwichDataUniswapV2.json', 'utf-8'));
    const sandwichData = JSON.parse(fs.readFileSync('sandwichDataUniswapV2.json', 'utf-8'));
    abiDecoder.addABI(ABI_UNISWAP_V2_ROUTER);
    abiDecoder.addABI(ABI_OTHER_CONTRACT);
    for (let i = 0; i < filteredData.length; i++) {
        const entry = filteredData[i];
        const { to, victimTxHash } = entry;
        console.log(`Processing entry ${i + 1}/${filteredData.length} - TxHash: ${victimTxHash}, To: ${to}`);
        const input = await fetchCallData(victimTxHash);
        if (!input) {
            console.warn(`No input data found for TxHash: ${victimTxHash}`);
            entry.amountOutMin = 'unknown';
            continue;
        }
        const decodedData = abiDecoder.decodeMethod(input);
        if (!decodedData) {
            console.warn(`Unable to decode call data for TxHash: ${victimTxHash}`);
            entry.amountOutMin = 'unknown';
            continue;
        }
        const amountOutMinParam = decodedData.params.find((param) => param.name === 'amountOutMin');
        const amountOutMinRaw = amountOutMinParam ? BigInt(amountOutMinParam.value) : BigInt('0');
        // Locate the matching entry in `sandwichDataUniswapV2.json`
        const matchingSandwich = sandwichData.find((poolEntry) => poolEntry.sandwichData.some((sandwich) => sandwich.some((tx) => tx.txHash === victimTxHash)));
        if (!matchingSandwich) {
            console.warn(`No matching sandwich found for TxHash: ${victimTxHash}`);
            entry.amountOutMin = 'unknown';
            continue;
        }
        // Find the `bought` token symbol and associated decimals
        const tokenData = matchingSandwich.poolInfo;
        const sandwichEntry = matchingSandwich.sandwichData.find((sandwich) => sandwich.some((tx) => tx.txHash === victimTxHash));
        const victimTx = sandwichEntry.find((tx) => tx.txHash === victimTxHash);
        if (!victimTx || !victimTx.bought) {
            console.warn(`No bought token info found for TxHash: ${victimTxHash}`);
            entry.amountOutMin = 'unknown';
            continue;
        }
        const boughtSymbol = victimTx.bought;
        const token = boughtSymbol === tokenData.token0.symbol ? tokenData.token0 : tokenData.token1;
        const decimals = parseInt(token.decimals, 10);
        // Calculate amountOutMin with token decimals
        const amountOutMin = Number(amountOutMinRaw) / 10 ** decimals;
        entry.amountOutMin = amountOutMin;
        console.log(`Decoded amountOutMin for TxHash: ${victimTxHash} in ${boughtSymbol}: ${amountOutMin}`);
    }
    // Save the updated data to a new JSON file
    fs.writeFileSync('filteredSandwichDataUniswapV2_completed.json', JSON.stringify(filteredData, null, 2), 'utf-8');
    console.log('Completed data saved to filteredSandwichDataUniswapV2_completed.json');
}
const filteredData = JSON.parse(fs.readFileSync('filteredSandwichDataUniswapV2.json', 'utf-8'));
const sandwichData = JSON.parse(fs.readFileSync('sandwichDataUniswapV2.json', 'utf-8'));
const filteredTxHashes = new Set(filteredData.map((entry) => entry.victimTxHash));
async function addMinAmountOutToCenter() {
    for (let poolEntry of sandwichData) {
        for (let sandwich of poolEntry.sandwichData) {
            for (let tx of sandwich) {
                if (filteredTxHashes.has(tx.txHash) && tx.label === 'center') {
                    const entry = filteredData.find((e) => e.victimTxHash === tx.txHash);
                    const minAmountOut = await getMinAmountOut(tx, poolEntry.poolInfo);
                    tx.minAmountOut = minAmountOut;
                }
            }
        }
    }
    fs.writeFileSync('filteredSandwichDataUniswapV2_withMinAmountOut.json', JSON.stringify(sandwichData, null, 2), 'utf-8');
    console.log('Updated data saved to filteredSandwichDataUniswapV2_withMinAmountOut.json');
}
function filterSandwichesWithMinAmountOut() {
    const data = JSON.parse(fs.readFileSync('filteredSandwichDataUniswapV2_withMinAmountOut.json', 'utf-8'));
    const filteredData = data
        .map((poolEntry) => (Object.assign(Object.assign({}, poolEntry), { sandwichData: poolEntry.sandwichData.filter((sandwich) => sandwich.some((tx) => tx.label === 'center' && tx.minAmountOut !== undefined)) })))
        .filter((poolEntry) => poolEntry.sandwichData.length > 0);
    fs.writeFileSync('uniV2minAmounts.json', JSON.stringify(filteredData, null, 2), 'utf-8');
    console.log('Filtered data saved to filteredSandwichDataUniswapV2_onlyWithMinAmountOut.json');
}
async function getMinAmountOut(tx, poolInfo) {
    const input = await fetchCallData(tx.txHash);
    if (!input)
        return 'unknown';
    const decodedData = abiDecoder.decodeMethod(input);
    const amountOutMinParam = decodedData === null || decodedData === void 0 ? void 0 : decodedData.params.find((param) => param.name === 'amountOutMin');
    if (!amountOutMinParam)
        return 'unknown';
    const amountOutMinRaw = BigInt(amountOutMinParam.value);
    const boughtSymbol = tx.bought;
    const token = boughtSymbol === poolInfo.token0.symbol ? poolInfo.token0 : poolInfo.token1;
    const decimals = parseInt(token.decimals, 10);
    return Number(amountOutMinRaw) / 10 ** decimals;
}
const allPoolData = [];
const simData = [];
let victimTransactions = [];
let sandwichOverview;
let numberSandwichGotVictimTxMined = 0;
function removeDuplicateVictimTxHash() {
    // Load data from JSON file
    const data = JSON.parse(fs.readFileSync('filteredSandwichDataUniswapV2_completed.json', 'utf-8'));
    // Use a Set to track unique victimTxHashes and filter duplicates
    const uniqueTxHashes = new Set();
    const deduplicatedData = data.filter((entry) => {
        if (uniqueTxHashes.has(entry.victimTxHash)) {
            return false; // Duplicate found, filter it out
        }
        uniqueTxHashes.add(entry.victimTxHash); // Add new unique txHash
        return true;
    });
    // Save deduplicated data back to the file
    fs.writeFileSync('filteredSandwichDataUniswapV2_completed.json', JSON.stringify(deduplicatedData, null, 2), 'utf-8');
    console.log(`Duplicates removed. ${deduplicatedData.length} unique entries saved.`);
}
function filterFalsePositiveSandwiches() {
    // Load data from JSON file
    const data = JSON.parse(fs.readFileSync('uniV2minAmounts.json', 'utf-8'));
    // Helper function to check if first six digits match
    function fuzzyMatch(amount1, amount2) {
        const str1 = amount1.toFixed(6).replace('.', '').substring(0, 6);
        const str2 = amount2.toFixed(6).replace('.', '').substring(0, 6);
        return str1 === str2;
    }
    // Filter sandwiches based on the fuzzy comparison
    const filteredData = data.map((entry) => (Object.assign(Object.assign({}, entry), { sandwichData: entry.sandwichData.filter((sandwich) => {
            const frontrun = sandwich.find((tx) => tx.label === 'frontrun');
            const backrun = sandwich.find((tx) => tx.label === 'backrun');
            // Check for false positives with fuzzy matching
            return frontrun && backrun && fuzzyMatch(frontrun.boughtAmount, backrun.soldAmount);
        }) })));
    // Save the filtered data to a new JSON file
    fs.writeFileSync('uniV2minAmounts_filtered.json', JSON.stringify(filteredData, null, 2), 'utf-8');
    console.log('Filtered data saved to uniV2minAmounts_filtered.json');
}
function filterVictimTransactions() {
    // Load both JSON files
    const simData = JSON.parse(fs.readFileSync('simDataUniswapV2.json', 'utf-8'));
    const minAmountsData = JSON.parse(fs.readFileSync('uniV2minAmounts_filtered.json', 'utf-8'));
    // Extract all unique txHashes from the minAmountsData
    const validTxHashes = new Set();
    minAmountsData.forEach((entry) => {
        entry.sandwichData.forEach((sandwich) => {
            sandwich.forEach((transaction) => {
                if (transaction.txHash)
                    validTxHashes.add(transaction.txHash);
            });
        });
    });
    // Filter simData by checking if victimTxHash exists in validTxHashes
    const filteredSimData = simData
        .map((entry) => (Object.assign(Object.assign({}, entry), { victimTransactions: entry.victimTransactions.filter((victimTx) => validTxHashes.has(victimTx.victimTxHash)) })))
        .filter((entry) => entry.victimTransactions.length > 0);
    // Save the filtered result as a new JSON file
    fs.writeFileSync('filteredSimDataUniswapV2.json', JSON.stringify(filteredSimData, null, 2), 'utf-8');
    console.log('Filtered data saved to filteredSimDataUniswapV2.json');
}
async function processMissingMinAmounts() {
    const data = JSON.parse(fs.readFileSync('uniV2minAmounts_filtered.json', 'utf-8'));
    for (const poolEntry of data) {
        for (const sandwich of poolEntry.sandwichData) {
            for (let i = 0; i < sandwich.length; i++) {
                const tx = sandwich[i];
                // Check if it's a center transaction and missing minAmountOut
                if (tx.label === 'center' && tx.minAmountOut === undefined) {
                    console.log(`Processing center txHash: ${tx.txHash} for minAmountOut...`);
                    // Attempt to fetch the minAmountOut
                    const minAmountOut = await getMinAmountOut(tx, poolEntry.poolInfo);
                    if (minAmountOut !== 'unknown') {
                        // Add minAmountOut to the transaction if available
                        tx.minAmountOut = minAmountOut;
                    }
                    else {
                        // Remove the entire sandwich if minAmountOut could not be fetched
                        console.warn(`Removing sandwich with txHash: ${tx.txHash} due to missing minAmountOut.`);
                        poolEntry.sandwichData = poolEntry.sandwichData.filter((s) => s !== sandwich);
                        break; // Exit the inner loop since we removed the current sandwich
                    }
                }
            }
        }
    }
    // Save the updated data back to a new JSON file
    fs.writeFileSync('uniV2minAmounts_filtered_withMinAmounts.json', JSON.stringify(data, null, 2), 'utf-8');
    console.log('Updated data saved to uniV2minAmounts_filtered_withMinAmounts.json');
}
export async function uniswapV2positiveSandwichThings() {
    console.log('fetching...');
    console.time();
    /*
  
    const poolAddresses = [
      '0x6bcd2862522c0ab45f4f9fe693e36c791ede0a42',
      '0x52c77b0cb827afbad022e6d6caf2c44452edbc39',
      '0xc555d55279023e732ccd32d812114caf5838fd46',
      '0xc3576f38c32e95e36bbd8d91e6cbe646a3723110',
      '0xc3576f38c32e95e36bbd8d91e6cbe646a3723110',
      '0x308c6fbd6a14881af333649f17f2fde9cd75e2a6',
      '0x5c6919b79fac1c3555675ae59a9ac2484f3972f5',
      '0x69c7bd26512f52bf6f76fab834140d13dda673ca',
      '0x926381b8a1237585303051f376c74192e82b7a7e',
      '0x470dc172d6502ac930b59322ece5345dd456a03d',
    ];
  
    let poolCounter = 0;
    for (const poolAddress of poolAddresses) {
      victimTransactions = [];
      numberSandwichGotVictimTxMined = 0;
      // poolCounter++;
      // if (poolCounter >= 2) continue;
      // const poolAddress = '0x6bcd2862522c0ab45f4f9fe693e36c791ede0a42';
      const poolInfo = await loadUniswapV2Pool(poolAddress);
      // console.log('poolInfo:', poolInfo);
      const allEvents = await getEvents(poolAddress);
      // const allEvents = await getEvents(poolAddress, 20818632);
      // console.log('found', allEvents.length, 'allEvents');
  
      const swapEvents = await getSwapEvents(allEvents);
      console.log('found', swapEvents.length, 'swapEvents');
      const formattedEvents = formatEvents(swapEvents, poolInfo);
      // console.dir(formattedEvents, { depth: null, colors: true });
  
      const groupsWithDoubledUser = findSandwiches(formattedEvents);
      console.log('Found', Object.keys(groupsWithDoubledUser).length, 'groups with doubled user');
      // console.dir(groupsWithDoubledUser, { depth: null, colors: true });
  
      const sandwiches = extractSandwiches(groupsWithDoubledUser);
      // console.dir(sandwiches, { depth: null, colors: true });
  
      const sandwichGas = await addGasInfoToSandwichesFull(sandwiches, formattedEvents);
      // console.dir(sandwichGas, { depth: null, colors: true });
  
      // Format the output as an array of transactions with labels
      const sandwichData = sandwichGas.map((sandwich) => [
        {
          ...sandwich.frontrun,
          label: 'frontrun' as 'frontrun',
          sold: sandwich.frontrun.inputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
          bought: sandwich.frontrun.outputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
        },
        ...(Array.isArray(sandwich.center)
          ? sandwich.center.map((center) => ({
              ...center,
              label: 'center' as 'center',
              sold: center.inputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
              bought: center.outputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
            }))
          : [
              {
                ...sandwich.center,
                label: 'center' as 'center',
                sold: sandwich.center.inputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
                bought: sandwich.center.outputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
              },
            ]),
        {
          ...sandwich.backrun,
          label: 'backrun' as 'backrun',
          sold: sandwich.backrun.inputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
          bought: sandwich.backrun.outputTokenId === 'token0' ? poolInfo.token0.symbol : poolInfo.token1.symbol,
        },
      ]) as LabeledSwapEvent[][];
  
      allPoolData.push({ poolAddress, poolInfo, sandwichData });
  
      const probSammichWithAtLeast1MatchingTx = filterProbSammichWithAtLeast1MatchingTx(
        groupsWithDoubledUser,
        formattedEvents
      );
  
      const probSammichWithAtLeast1MatchingTxAndGas = await addGasInfoToSandwiches(
        probSammichWithAtLeast1MatchingTx,
        formattedEvents
      );
  
      const filteredResults = filterSandwichesByPositionAndGas(probSammichWithAtLeast1MatchingTxAndGas);
  
      console.log(
        'Found',
        Object.keys(probSammichWithAtLeast1MatchingTxAndGas).length,
        'potential sandwiches with 4th tx'
      );
      console.log('Found', Object.keys(filteredResults).length, 'filteredResults');
  
      // Get the complete set with missing transactions
      const fullSet = await addMissingTxHashes(filteredResults, formattedEvents);
      // console.dir(fullSet, { depth: null, colors: true });
      console.log('Found', Object.keys(fullSet).length, 'fullSet');
  
      const filteredSetForKnownContracts = await filterFullSetByAllowedAddresses(allowedAddresses, fullSet);
      // console.dir(filteredSetForKnownContracts, { depth: null, colors: true });
      console.log('Found', Object.keys(filteredSetForKnownContracts).length, 'filteredSetForKnownContracts');
  
      // Process each victim transaction
      for (const result of filteredSetForKnownContracts) {
        // console.log('');
        let res = await processVictimTransaction(result, formattedEvents, poolAddress, poolInfo);
        if (res) victimTransactions.push(res);
      }
      sandwichOverview = {
        numberSwaps: swapEvents.length,
        numberSandwiches: Object.keys(groupsWithDoubledUser).length,
        numberSandwichGotVictimTxMined: numberSandwichGotVictimTxMined,
      };
      simData.push({ poolAddress, poolInfo, sandwichOverview, victimTransactions });
    }
  
    // Save the data to a JSON file
    fs.writeFileSync('sandwichDataUniswapV2.json', JSON.stringify(allPoolData, null, 2), 'utf-8');
    fs.writeFileSync('simDataUniswapV2.json', JSON.stringify(simData, null, 2), 'utf-8');
  */
    // transformAndSaveData();
    // await processTransactionsAndSave();
    // await filterSandwichesWithMinAmountOut();
    // removeDuplicateVictimTxHash();
    // await filterFalsePositiveSandwiches();
    // await filterVictimTransactions();
    await processMissingMinAmounts();
    console.timeEnd();
}
const ABI_UNISWAP_V2_ROUTER = [
    {
        inputs: [
            { internalType: 'address', name: '_factory', type: 'address' },
            { internalType: 'address', name: '_WETH', type: 'address' },
        ],
        stateMutability: 'nonpayable',
        type: 'constructor',
    },
    {
        inputs: [],
        name: 'WETH',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' },
            { internalType: 'uint256', name: 'amountADesired', type: 'uint256' },
            { internalType: 'uint256', name: 'amountBDesired', type: 'uint256' },
            { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'addLiquidity',
        outputs: [
            { internalType: 'uint256', name: 'amountA', type: 'uint256' },
            { internalType: 'uint256', name: 'amountB', type: 'uint256' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: 'amountTokenDesired', type: 'uint256' },
            { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'addLiquidityETH',
        outputs: [
            { internalType: 'uint256', name: 'amountToken', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETH', type: 'uint256' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
        ],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'factory',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'uint256', name: 'reserveIn', type: 'uint256' },
            { internalType: 'uint256', name: 'reserveOut', type: 'uint256' },
        ],
        name: 'getAmountIn',
        outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
        stateMutability: 'pure',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'reserveIn', type: 'uint256' },
            { internalType: 'uint256', name: 'reserveOut', type: 'uint256' },
        ],
        name: 'getAmountOut',
        outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
        stateMutability: 'pure',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
        ],
        name: 'getAmountsIn',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
        ],
        name: 'getAmountsOut',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountA', type: 'uint256' },
            { internalType: 'uint256', name: 'reserveA', type: 'uint256' },
            { internalType: 'uint256', name: 'reserveB', type: 'uint256' },
        ],
        name: 'quote',
        outputs: [{ internalType: 'uint256', name: 'amountB', type: 'uint256' }],
        stateMutability: 'pure',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
            { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'removeLiquidity',
        outputs: [
            { internalType: 'uint256', name: 'amountA', type: 'uint256' },
            { internalType: 'uint256', name: 'amountB', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
            { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'removeLiquidityETH',
        outputs: [
            { internalType: 'uint256', name: 'amountToken', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETH', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
            { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'removeLiquidityETHSupportingFeeOnTransferTokens',
        outputs: [{ internalType: 'uint256', name: 'amountETH', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
            { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
            { internalType: 'bool', name: 'approveMax', type: 'bool' },
            { internalType: 'uint8', name: 'v', type: 'uint8' },
            { internalType: 'bytes32', name: 'r', type: 'bytes32' },
            { internalType: 'bytes32', name: 's', type: 'bytes32' },
        ],
        name: 'removeLiquidityETHWithPermit',
        outputs: [
            { internalType: 'uint256', name: 'amountToken', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETH', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
            { internalType: 'uint256', name: 'amountTokenMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountETHMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
            { internalType: 'bool', name: 'approveMax', type: 'bool' },
            { internalType: 'uint8', name: 'v', type: 'uint8' },
            { internalType: 'bytes32', name: 'r', type: 'bytes32' },
            { internalType: 'bytes32', name: 's', type: 'bytes32' },
        ],
        name: 'removeLiquidityETHWithPermitSupportingFeeOnTransferTokens',
        outputs: [{ internalType: 'uint256', name: 'amountETH', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' },
            { internalType: 'uint256', name: 'liquidity', type: 'uint256' },
            { internalType: 'uint256', name: 'amountAMin', type: 'uint256' },
            { internalType: 'uint256', name: 'amountBMin', type: 'uint256' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
            { internalType: 'bool', name: 'approveMax', type: 'bool' },
            { internalType: 'uint8', name: 'v', type: 'uint8' },
            { internalType: 'bytes32', name: 'r', type: 'bytes32' },
            { internalType: 'bytes32', name: 's', type: 'bytes32' },
        ],
        name: 'removeLiquidityWithPermit',
        outputs: [
            { internalType: 'uint256', name: 'amountA', type: 'uint256' },
            { internalType: 'uint256', name: 'amountB', type: 'uint256' },
        ],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapETHForExactTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactETHForTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactETHForTokensSupportingFeeOnTransferTokens',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactTokensForETH',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactTokensForTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapTokensForExactETH',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'to', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
        ],
        name: 'swapTokensForExactTokens',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    { stateMutability: 'payable', type: 'receive' },
];
const ABI_OTHER_CONTRACT = [
    { inputs: [{ internalType: 'address', name: 'target', type: 'address' }], name: 'AddressEmptyCode', type: 'error' },
    {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'AddressInsufficientBalance',
        type: 'error',
    },
    { inputs: [], name: 'AlreadyInitialized', type: 'error' },
    { inputs: [], name: 'EnforcedPause', type: 'error' },
    { inputs: [], name: 'ExpectedPause', type: 'error' },
    { inputs: [], name: 'FailedInnerCall', type: 'error' },
    { inputs: [], name: 'NotInitializing', type: 'error' },
    { inputs: [{ internalType: 'address', name: 'owner', type: 'address' }], name: 'OwnableInvalidOwner', type: 'error' },
    {
        inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
        name: 'OwnableUnauthorizedAccount',
        type: 'error',
    },
    { inputs: [], name: 'ReentrancyGuardReentrantCall', type: 'error' },
    {
        inputs: [{ internalType: 'address', name: 'token', type: 'address' }],
        name: 'SafeERC20FailedOperation',
        type: 'error',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'token', type: 'address' },
            { indexed: true, internalType: 'address', name: 'payer', type: 'address' },
            { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
            { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
        ],
        name: 'FeeCollected',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [{ indexed: false, internalType: 'uint64', name: 'version', type: 'uint64' }],
        name: 'Initialized',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [
            { indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' },
            { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' },
        ],
        name: 'OwnershipTransferred',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [{ indexed: false, internalType: 'address', name: 'account', type: 'address' }],
        name: 'Paused',
        type: 'event',
    },
    {
        anonymous: false,
        inputs: [{ indexed: false, internalType: 'address', name: 'account', type: 'address' }],
        name: 'Unpaused',
        type: 'event',
    },
    {
        inputs: [],
        name: 'WETH',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'amountInCached',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'factoryV2',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'factoryV3',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'feeCollector',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'feeDenominator',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: '', type: 'address' }],
        name: 'feeExcludeList',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'feeRate',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' },
            { internalType: 'uint24', name: 'fee', type: 'uint24' },
        ],
        name: 'getPool',
        outputs: [{ internalType: 'contract IUniswapV3Pool', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: '_factoryV2', type: 'address' },
            { internalType: 'address', name: '_factoryV3', type: 'address' },
            { internalType: 'address', name: '_WETH', type: 'address' },
            { internalType: 'address', name: '_feeCollector', type: 'address' },
            { internalType: 'uint256', name: '_feeRate', type: 'uint256' },
        ],
        name: 'initialize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'owner',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    { inputs: [], name: 'pause', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    {
        inputs: [],
        name: 'paused',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
    },
    { inputs: [], name: 'renounceOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    {
        inputs: [
            { internalType: 'address', name: 'token', type: 'address' },
            { internalType: 'address', name: 'recipient', type: 'address' },
        ],
        name: 'rescueERC20Token',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
        name: 'setFeeCollector',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'addr', type: 'address' },
            { internalType: 'bool', name: 'isExcluded', type: 'bool' },
        ],
        name: 'setFeeExclude',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'uint256', name: 'rate', type: 'uint256' }],
        name: 'setFeeRate',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: 'addr', type: 'address' }],
        name: 'setWETH',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { internalType: 'string[]', name: 'routes', type: 'string[]' },
                    { internalType: 'bytes', name: 'path1', type: 'bytes' },
                    { internalType: 'address', name: 'factory1', type: 'address' },
                    { internalType: 'bytes', name: 'path2', type: 'bytes' },
                    { internalType: 'address', name: 'factory2', type: 'address' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
                ],
                internalType: 'struct SwapX.ExactInputMixedParams',
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'swapMixedMultiHopExactIn',
        outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { internalType: 'string[]', name: 'routes', type: 'string[]' },
                    { internalType: 'bytes', name: 'path1', type: 'bytes' },
                    { internalType: 'address', name: 'factory1', type: 'address' },
                    { internalType: 'bytes', name: 'path2', type: 'bytes' },
                    { internalType: 'address', name: 'factory2', type: 'address' },
                    { internalType: 'uint256', name: 'amountIn2', type: 'uint256' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountInMaximum', type: 'uint256' },
                ],
                internalType: 'struct SwapX.ExactOutputMixedParams',
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'swapMixedMultiHopExactOut',
        outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenIn', type: 'address' },
            { internalType: 'address', name: 'tokenOut', type: 'address' },
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address', name: 'poolAddress', type: 'address' },
        ],
        name: 'swapV2ExactIn',
        outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenIn', type: 'address' },
            { internalType: 'address', name: 'tokenOut', type: 'address' },
            { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'address', name: 'poolAddress', type: 'address' },
        ],
        name: 'swapV2ExactOut',
        outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenIn', type: 'address' },
            { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOutMin', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'recipient', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
            { internalType: 'address', name: 'factory', type: 'address' },
        ],
        name: 'swapV2MultiHopExactIn',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'tokenIn', type: 'address' },
            { internalType: 'uint256', name: 'amountInMax', type: 'uint256' },
            { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
            { internalType: 'address', name: 'recipient', type: 'address' },
            { internalType: 'uint256', name: 'deadline', type: 'uint256' },
            { internalType: 'address', name: 'factory', type: 'address' },
        ],
        name: 'swapV2MultiHopExactOut',
        outputs: [{ internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { internalType: 'address', name: 'tokenIn', type: 'address' },
                    { internalType: 'address', name: 'tokenOut', type: 'address' },
                    { internalType: 'uint24', name: 'fee', type: 'uint24' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
                    { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                internalType: 'struct SwapX.ExactInputSingleParams',
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'swapV3ExactIn',
        outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { internalType: 'address', name: 'tokenIn', type: 'address' },
                    { internalType: 'address', name: 'tokenOut', type: 'address' },
                    { internalType: 'uint24', name: 'fee', type: 'uint24' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountInMaximum', type: 'uint256' },
                    { internalType: 'uint160', name: 'sqrtPriceLimitX96', type: 'uint160' },
                ],
                internalType: 'struct SwapX.ExactOutputSingleParams',
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'swapV3ExactOut',
        outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { internalType: 'bytes', name: 'path', type: 'bytes' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOutMinimum', type: 'uint256' },
                ],
                internalType: 'struct SwapX.ExactInputParams',
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'swapV3MultiHopExactIn',
        outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [
            {
                components: [
                    { internalType: 'bytes', name: 'path', type: 'bytes' },
                    { internalType: 'address', name: 'tokenIn', type: 'address' },
                    { internalType: 'address', name: 'recipient', type: 'address' },
                    { internalType: 'uint256', name: 'deadline', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
                    { internalType: 'uint256', name: 'amountInMaximum', type: 'uint256' },
                ],
                internalType: 'struct SwapX.ExactOutputParams',
                name: 'params',
                type: 'tuple',
            },
        ],
        name: 'swapV3MultiHopExactOut',
        outputs: [{ internalType: 'uint256', name: 'amountIn', type: 'uint256' }],
        stateMutability: 'payable',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }],
        name: 'transferOwnership',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'int256', name: 'amount0Delta', type: 'int256' },
            { internalType: 'int256', name: 'amount1Delta', type: 'int256' },
            { internalType: 'bytes', name: '_data', type: 'bytes' },
        ],
        name: 'uniswapV3SwapCallback',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    { inputs: [], name: 'unpause', outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { stateMutability: 'payable', type: 'receive' },
];
// Initialize ABIs and run the function
abiDecoder.addABI(ABI_UNISWAP_V2_ROUTER);
abiDecoder.addABI(ABI_OTHER_CONTRACT);
//# sourceMappingURL=SandwicheResearchUniV2.js.map