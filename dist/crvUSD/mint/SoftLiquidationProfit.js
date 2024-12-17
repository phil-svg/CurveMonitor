import { findCoinDecimalsById, findCoinSymbolById, getCoinIdByAddress, } from '../../utils/postgresTables/readFunctions/Coins.js';
import { getEthPriceWithTimestampFromTable, getPriceFromDb, } from '../../utils/postgresTables/readFunctions/PriceMap.js';
import { getHistoricalTokenPriceFromDefiLlama } from '../../utils/TokenPrices/txValue/DefiLlama.js';
import { getBlockTimeStampFromNode, WEB3_HTTP_PROVIDER, web3Call } from '../../utils/web3Calls/generic.js';
import Big from 'big.js';
import { CurveTricryptoOptimizedWETH, getCrvUSD_USDT, getLlammaContract, getTricrypto2Contract, } from './Contracts.js';
const ADDRESS_CRVUSD = '0xf939e0a03fb07f59a73314e73794be0e57ac1b4e';
const ADDRESS_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const ADDRESS_WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const ADDRESS_wstETH = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';
const ADDRESS_tBTC = '0x18084fbA666a33d37592fA2633fD49a74DD93a88';
const ADDRESS_sfrxETH = '0xac3E018457B222d93114458476f3E3416Abbe38F';
async function getCallTraceViaAlchemy(txHash) {
    const response = await fetch(process.env.WEB3_HTTP, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            method: 'trace_transaction',
            params: [txHash],
            id: 1,
            jsonrpc: '2.0',
        }),
    });
    if (response.status !== 200) {
        return 'request failed';
    }
    const data = (await response.json());
    return data.result;
}
async function adjustBalancesForDecimals(balanceChanges) {
    // Loop over each balance change
    for (let balanceChange of balanceChanges) {
        // Fetch the token's decimals and symbol
        const tokenID = await getCoinIdByAddress(balanceChange.token);
        if (!tokenID) {
            console.log('unknown tokenId for', balanceChange.token);
            continue;
        }
        const decimals = await findCoinDecimalsById(tokenID);
        if (!decimals) {
            console.log('unknown decimals for', balanceChange.tokenSymbol, balanceChange.token);
            continue;
        }
        const symbol = await findCoinSymbolById(tokenID);
        if (!symbol) {
            console.log('unknown symbol for', balanceChange.tokenSymbol, balanceChange.token);
            continue;
        }
        // Create a Big.js instance of the balance change and the token's decimals
        const balanceBig = new Big(balanceChange.balanceChange);
        const decimalsBig = new Big(10).pow(decimals);
        // Divide the balance change by the token's decimals
        const adjustedBalance = balanceBig.div(decimalsBig).toString();
        // Update the balance change
        balanceChange.balanceChange = adjustedBalance;
        // Update the token symbol
        balanceChange.tokenSymbol = symbol;
    }
    return balanceChanges;
}
function getTransferEventsFromTrace(callTraces, userAddress) {
    const transferEvents = [];
    const transferMethodId = '0xa9059cbb';
    const transferFromMethodId = '0x23b872dd';
    const withdrawMethodId = '0x2e1a7d4d';
    const customBurnMethodId = '0xba087652';
    const userAddressLower = userAddress.toLowerCase();
    for (const callTrace of callTraces) {
        const action = callTrace.action;
        // Check if the input starts with the transfer method id, transferFrom method id, withdraw method id or custom burn method id
        if (action.input &&
            (action.input.toLowerCase().startsWith(transferMethodId) ||
                action.input.toLowerCase().startsWith(transferFromMethodId) ||
                action.input.toLowerCase().startsWith(withdrawMethodId) ||
                action.input.toLowerCase().startsWith(customBurnMethodId))) {
            let sender, receiver, amountHex;
            if (action.input.toLowerCase().startsWith(transferMethodId)) {
                sender = action.from;
                // Extract receiver and amount from the input
                receiver = '0x' + action.input.slice(34, 74);
                amountHex = action.input.slice(74, 138);
            }
            else if (action.input.toLowerCase().startsWith(transferFromMethodId)) {
                // Extract sender, receiver and amount from the input for transferFrom
                sender = '0x' + action.input.slice(34, 74);
                receiver = '0x' + action.input.slice(98, 138);
                amountHex = action.input.slice(162, 202);
            }
            else if (action.input.toLowerCase().startsWith(withdrawMethodId)) {
                // Added this block
                sender = action.from;
                // The receiver is the user who sent the transaction
                receiver = action.from;
                // Extract the amount from the input
                amountHex = action.input.slice(10, 74);
            }
            else if (action.input.toLowerCase().startsWith(customBurnMethodId)) {
                // Handle the custom burn function
                sender = action.from;
                receiver = '0x' + action.input.slice(74, 114); // Extract receiver from the input
                amountHex = action.input.slice(34, 74); // Extract amount from the input
            }
            const amount = BigInt('0x' + amountHex).toString(); // convert from hex to decimal
            // Check if this log is a transfer from or to the userAddress
            if (sender.toLowerCase() === userAddressLower || receiver.toLowerCase() === userAddressLower) {
                const transferEvent = {
                    from: sender,
                    to: receiver,
                    value: amount,
                    token: action.to, // Add the contract address receiving the call
                };
                transferEvents.push(transferEvent);
            }
        }
    }
    return transferEvents;
}
function getTokenBalanceChangesOld(transferEvents, userAddress) {
    let balanceChangesMap = {};
    for (const event of transferEvents) {
        if (!(event.token in balanceChangesMap)) {
            balanceChangesMap[event.token] = BigInt(0);
        }
        let eventValue = BigInt(event.value);
        if (event.from.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] -= eventValue;
        }
        else if (event.to.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] += eventValue;
        }
    }
    const balanceChanges = [];
    for (const [token, balanceChange] of Object.entries(balanceChangesMap)) {
        if (balanceChange >= BigInt(100)) {
            // check if the balance change is greater or equal to 100
            balanceChanges.push({ token, balanceChange: balanceChange.toString() });
        }
    }
    return balanceChanges;
}
function getTokenBalanceChanges(transferEvents, userAddress) {
    let balanceChangesMap = {};
    for (const event of transferEvents) {
        if (!(event.token in balanceChangesMap)) {
            balanceChangesMap[event.token] = BigInt(0);
        }
        let eventValue = BigInt(event.value);
        if (event.from.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] -= eventValue;
        }
        else if (event.to.toLowerCase() === userAddress.toLowerCase()) {
            balanceChangesMap[event.token] += eventValue;
        }
    }
    const balanceChanges = [];
    for (const [token, balanceChange] of Object.entries(balanceChangesMap)) {
        balanceChanges.push({ token, balanceChange: balanceChange.toString() });
    }
    return balanceChanges;
}
function calculateEthBalanceChangeFilteredForLlama(callTrace, userAddress, market) {
    var _a, _b, _c, _d, _e;
    const llammaAddress = market.llamma.toLowerCase();
    let balanceChange = 0;
    for (const call of callTrace) {
        // Check if `action` exists and is an object with required properties
        if (!call.action || typeof call.action !== 'object') {
            continue;
        }
        // Ensure the call type is 'call'
        if (call.action.callType !== 'call')
            continue;
        // Parse the value (default to 0 if value is missing or invalid)
        const value = parseInt((_a = call.action.value) !== null && _a !== void 0 ? _a : '0', 16);
        // Filter for calls involving the llamma address
        const isLlammaInvolved = ((_b = call.action.from) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === llammaAddress || ((_c = call.action.to) === null || _c === void 0 ? void 0 : _c.toLowerCase()) === llammaAddress;
        if (!isLlammaInvolved)
            continue;
        // Adjust balance based on the user's role in the transfer
        if (((_d = call.action.from) === null || _d === void 0 ? void 0 : _d.toLowerCase()) === userAddress.toLowerCase()) {
            balanceChange -= value;
        }
        if (((_e = call.action.to) === null || _e === void 0 ? void 0 : _e.toLowerCase()) === userAddress.toLowerCase()) {
            balanceChange += value;
        }
    }
    return balanceChange;
}
function calculateEthBalanceChange(callTrace, userAddress) {
    let balanceChange = 0;
    for (let i = 0; i < callTrace.length; i++) {
        const call = callTrace[i];
        // We only want to consider 'call' types for ETH transfers
        if (call.action.callType !== 'call') {
            continue;
        }
        // Convert the value to a number for easier calculation
        const value = parseInt(call.action.value, 16);
        // If the user is the sender, decrease their balance
        if (call.action.from.toLowerCase() === userAddress.toLowerCase()) {
            balanceChange -= value;
        }
        // If the user is the recipient, increase their balance
        if (call.action.to.toLowerCase() === userAddress.toLowerCase()) {
            balanceChange += value;
        }
    }
    return balanceChange;
}
function addEthBalanceChange(balanceChanges, ethBalanceChange) {
    if (ethBalanceChange !== 0) {
        balanceChanges.push({
            token: ADDRESS_ETH,
            balanceChange: ethBalanceChange,
        });
    }
    return balanceChanges;
}
export async function getPrice(unixtime, address) {
    const price = await getHistoricalTokenPriceFromDefiLlama(address, unixtime);
    return price;
}
async function calculateAbsDollarBalance(unixtime, decimalAdjustedBalanceChanges) {
    let total = 0;
    for (const item of decimalAdjustedBalanceChanges) {
        // Convert WETH address to ETH address
        const tokenAddress = item.token.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' ? ADDRESS_ETH : item.token;
        let price = await getPriceFromDb(tokenAddress, unixtime);
        if (!price)
            price = await getPrice(unixtime, tokenAddress);
        if (price !== null) {
            const valueInDollars = item.balanceChange * price;
            total += valueInDollars;
        }
    }
    return total;
}
async function getPriceOnchain(tokenAddress, blockNumber) {
    if (tokenAddress.toLowerCase() === ADDRESS_CRVUSD.toLowerCase()) {
        const contract = await getCrvUSD_USDT();
        return (await web3Call(contract, 'get_dy', [1, 0, '1000000000000000000'], blockNumber)) / 1e6;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_ETH.toLowerCase()) {
        const contract = await getTricrypto2Contract();
        const priceTricrypto2 = (await web3Call(contract, 'get_dy', [2, 0, '1000000000000000000'], blockNumber)) / 1e6;
        return priceTricrypto2;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_WBTC.toLowerCase()) {
        const contract = await getTricrypto2Contract();
        return (await web3Call(contract, 'get_dy', [1, 0, '100000000'], blockNumber)) / 1e6;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_wstETH.toLowerCase()) {
        const contract = await CurveTricryptoOptimizedWETH();
        return (await web3Call(contract, 'get_dy', [2, 0, '1000000000000000000'], blockNumber)) / 1e18;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_tBTC.toLowerCase()) {
        const contract = await CurveTricryptoOptimizedWETH();
        return (await web3Call(contract, 'get_dy', [1, 0, '1000000000000000000'], blockNumber)) / 1e18;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_sfrxETH.toLowerCase()) {
        return null; // no cases or good contracts
    }
    return null;
}
async function getDyOnchain(tokenAddress, blockNumber, dx) {
    if (tokenAddress.toLowerCase() === ADDRESS_CRVUSD.toLowerCase()) {
        const contract = await getCrvUSD_USDT();
        return (await web3Call(contract, 'get_dy', [1, 0, dx], blockNumber)) / 1e6;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_ETH.toLowerCase()) {
        const contract = await getTricrypto2Contract();
        const tetherId = 0;
        const wethId = 2;
        const dyTricrypto2 = (await web3Call(contract, 'get_dy', [wethId, tetherId, dx], blockNumber)) / 1e6;
        console.log('dyTricrypto2', dyTricrypto2, dx);
        return dyTricrypto2;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_WBTC.toLowerCase()) {
        const contract = await getTricrypto2Contract();
        return (await web3Call(contract, 'get_dy', [1, 0, dx], blockNumber)) / 1e6;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_wstETH.toLowerCase()) {
        const contract = await CurveTricryptoOptimizedWETH();
        return (await web3Call(contract, 'get_dy', [2, 0, dx], blockNumber)) / 1e18;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_tBTC.toLowerCase()) {
        const contract = await CurveTricryptoOptimizedWETH();
        return (await web3Call(contract, 'get_dy', [1, 0, dx], blockNumber)) / 1e18;
    }
    if (tokenAddress.toLowerCase() === ADDRESS_sfrxETH.toLowerCase()) {
        return null; // no cases or good contracts
    }
    return null;
}
async function calculateAbsDollarBalanceOnchain(unixtime, decimalAdjustedBalanceChanges, blockNumber, userTransfersInAndOut) {
    let total = 0;
    // blockNumber = blockNumber--;
    // console.log('decimalAdjustedBalanceChanges', decimalAdjustedBalanceChanges);
    let counter = 0;
    for (const item of decimalAdjustedBalanceChanges) {
        // console.log('', item);
        counter++;
        // Convert WETH address to ETH address
        const tokenAddress = item.token.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' ? ADDRESS_ETH : item.token;
        // const matchingTransfer = userTransfersInAndOut.find(
        //   (transfer) => transfer.token.toLowerCase() === item.token.toLowerCase()
        // );
        // const TricryptoUSDC = await getTricryptoUSDCContract();
        // const dy2 = (await web3Call(TricryptoUSDC, 'get_dy', [0, 2, '35510933817'], blockNumber)) / 1e18;
        // console.log(blockNumber, 'dy2', dy2);
        // const dx = matchingTransfer ? matchingTransfer.value : '0';
        // let dy = await getDyOnchain(tokenAddress, blockNumber, dx);
        // if (!dy) return 0;
        // console.log(tokenAddress, 'dx', dx, 'dy', dy);
        // const priceFromDy = Math.abs(dy / item.balanceChange);
        // console.log('priceFromDy', priceFromDy);
        let price = await getPriceOnchain(tokenAddress, blockNumber);
        if (!price) {
            // console.log('fetching from defillama for token', tokenAddress);
            price = await getPrice(unixtime, tokenAddress);
        }
        // console.log('mayble the false price:', price);
        if (price !== null) {
            const valueInDollars = item.balanceChange * price;
            // console.log('valueInDollars', valueInDollars, 'tokenAddress', tokenAddress);
            total += valueInDollars;
        }
    }
    //process.exit();
    return total;
}
function filterForLlama(userTransfersInAndOut, market) {
    const llammaAddress = market.llamma.toLowerCase();
    return userTransfersInAndOut.filter((change) => {
        return change.from.toLowerCase() === llammaAddress || change.to.toLowerCase() === llammaAddress;
    });
}
async function getRevenueForAddress(unixtime, CALL_TRACE, user, market, blockNumber) {
    const print = false;
    const userTransfersInAndOut = getTransferEventsFromTrace(CALL_TRACE, user);
    if (print)
        console.log(user, 'userTransfersInAndOut', userTransfersInAndOut);
    const filteredForLlama = filterForLlama(userTransfersInAndOut, market);
    if (print)
        console.log(user, 'filteredForLlama', filteredForLlama);
    const balanceChanges = getTokenBalanceChanges(filteredForLlama, user);
    if (print)
        console.log(user, 'balanceChanges', balanceChanges);
    const ethBalanceChange = calculateEthBalanceChangeFilteredForLlama(CALL_TRACE, user, market);
    const balanceChangesWithEth = addEthBalanceChange(balanceChanges, ethBalanceChange);
    const decimalAdjustedBalanceChanges = await adjustBalancesForDecimals(balanceChangesWithEth);
    if (!decimalAdjustedBalanceChanges)
        return 0;
    if (print)
        console.log(user, 'decimalAdjustedBalanceChanges', decimalAdjustedBalanceChanges);
    // const llamma = await getLlammaContract(market.llamma);
    // const priceOracle = await web3Call(llamma, 'price_oracle', [], blockNumber);
    // if (print) console.log('priceOracle', priceOracle);
    const revenue = await calculateAbsDollarBalanceOnchain(unixtime, decimalAdjustedBalanceChanges, blockNumber, userTransfersInAndOut);
    return revenue;
}
// async function getRevenue(unixtime: number, event: any, market: MarketData): Promise<number> {
//   const CALL_TRACE = await getCallTraceViaAlchemy(event.transactionHash);
//   const buyer = CALL_TRACE[0].action.from;
//   const to = CALL_TRACE[0].action.to;
//   const revenueBuyer = await getRevenueForAddress(unixtime, CALL_TRACE, buyer, market);
//   const revenueTo = await getRevenueForAddress(unixtime, CALL_TRACE, to, market);
//   return Math.max(revenueBuyer, revenueTo);
// }
async function getCosts(unixtime, txHash) {
    try {
        const txReceipt = await WEB3_HTTP_PROVIDER.eth.getTransactionReceipt(txHash);
        const gasUsed = txReceipt.gasUsed;
        const tx = await WEB3_HTTP_PROVIDER.eth.getTransaction(txHash);
        const gasPrice = tx.gasPrice;
        const cost = WEB3_HTTP_PROVIDER.utils.toBN(gasUsed).mul(WEB3_HTTP_PROVIDER.utils.toBN(gasPrice));
        let txCostInETHER = Number(WEB3_HTTP_PROVIDER.utils.fromWei(cost, 'ether'));
        let etherPrice = await getEthPriceWithTimestampFromTable(unixtime);
        if (!etherPrice)
            return null;
        let txCost = txCostInETHER * etherPrice;
        return txCost;
    }
    catch (error) {
        console.error(error);
        return null;
    }
}
// export async function solveProfit(
//   event: any,
//   market: MarketData
// ): Promise<{ netProfit: number; grossRevenue: number; totalCost: number; txHash: string } | null> {
//   const txHash = event.transactionHash;
//   try {
//     // const unixtime = Math.floor(new Date(event.dt).getTime() / 1000);
//     const unixtime = await getBlockTimeStampFromNode(event.blockNumber);
//     if (!unixtime) return null;
//     let grossRevenue = await getRevenue(unixtime, event, market);
//     if (!grossRevenue && grossRevenue !== 0) return null;
//     let totalCost = await getCosts(unixtime, txHash);
//     if (!totalCost) return null;
//     let netProfit = grossRevenue - totalCost;
//     return {
//       netProfit,
//       grossRevenue,
//       totalCost,
//       txHash,
//     };
//   } catch (err) {
//     console.log('err in solveProfit: ', err);
//     return null;
//   }
// }
async function getRevenueClean(unixtime, event, market) {
    const CALL_TRACE = await getCallTraceViaAlchemy(event.transactionHash);
    const revenueBuyer = await getRevenueForAddress(unixtime, CALL_TRACE, market.llamma, market, event.blockNumber);
    if (revenueBuyer === null)
        return null;
    return revenueBuyer * -1;
}
export async function getSoftLiquidationRevenue(event, market) {
    try {
        // const unixtime = Math.floor(new Date(event.dt).getTime() / 1000);
        const unixtime = await getBlockTimeStampFromNode(event.blockNumber);
        if (!unixtime)
            return { softLiquidationRevenue: null, timestamp: null };
        let grossRevenue = await getRevenueClean(unixtime, event, market);
        return { softLiquidationRevenue: grossRevenue, timestamp: unixtime };
    }
    catch (err) {
        console.log('err in solveProfit: ', err);
        return { softLiquidationRevenue: null, timestamp: null };
    }
}
export async function meassureSoftLiquidation(event, market) {
    const unixtime = await getBlockTimeStampFromNode(event.blockNumber);
    const llamma = await getLlammaContract(market.llamma);
    const priceOracle = (await web3Call(llamma, 'price_oracle', [], event.blockNumber)) / 1e18;
    const currentPrice = (await web3Call(llamma, 'get_p', [], event.blockNumber)) / 1e18;
    return {
        priceOracle,
        currentPrice,
        timestamp: unixtime,
    };
}
//# sourceMappingURL=SoftLiquidationProfit.js.map