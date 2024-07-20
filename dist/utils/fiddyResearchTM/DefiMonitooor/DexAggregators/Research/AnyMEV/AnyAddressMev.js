import { getWeb3HttpProviderForChain } from '../../../../../helperFunctions/Web3.js';
import { getBlockTimeStampFromProvider, getPastEvents, getTxFromTxHashAndProvider, } from '../../../../../web3Calls/generic.js';
import { getCustomContract } from './CustomContract.js';
import { getCleanedTransfersWOdbWOtraceForChain } from './CleanTransfersWOdb.js';
import { isCexDexArbWOdb } from './CexDexArbs.js';
import { getFuzzyVolumeForGenericTx } from './Volume.js';
import { saveResultsToJsonFile, saveVolumeDictionaryToJsonFile, writeTransactionsToCSV, } from './Helper.js';
import { aggregateAndSaveVolumesByToAddress, filterAndSaveTransactionsByToAddress, loadAndCalculateHourlyVolumes, saveHourlyDataToCsvForVisuals, } from './Visuals.js';
async function solveSingleTxHash(txHash, chain, web3HttpProvider, poolContractAddress) {
    const txDetails = await getTxFromTxHashAndProvider(txHash, web3HttpProvider);
    const from = txDetails.from;
    const to = txDetails.to;
    // if (to.toLowerCase() === '0x25cE4B4dcb620b73a78f91CD66f6e3e5Ef8f487C'.toLowerCase()) {
    //   console.log('hit', txHash);
    //   process.exit();
    // }
    const blockNumber = txDetails.blockNumber;
    const position = txDetails.transactionIndex;
    const getAllToken = false;
    const cleanedTransfers = await getCleanedTransfersWOdbWOtraceForChain(txHash, chain, web3HttpProvider, to, getAllToken);
    if (!cleanedTransfers) {
        console.log('No cleanedTransfers');
        return null;
    }
    const unixTimestamp = await getBlockTimeStampFromProvider(txDetails.blockNumber, web3HttpProvider);
    if (!unixTimestamp) {
        console.log('failed to get unixTimestamp');
        return null;
    }
    const volInUsd = await getFuzzyVolumeForGenericTx(poolContractAddress, cleanedTransfers, unixTimestamp);
    console.log(txHash, 'Volume in $K: ', Number((Number(volInUsd.toFixed(0)) / 1000).toFixed(0)));
    let volInUsdCexDexArb = 0;
    let volInUsdAtomicArb = 0;
    // const atomicArbInfo = await solveAtomicArbWOdbForChain(
    //   txHash,
    //   cleanedTransfers,
    //   from,
    //   to,
    //   position,
    //   txDetails,
    //   chain,
    //   web3HttpProvider
    // );
    let isAtomicArb = false;
    // if (atomicArbInfo === 'arb') isAtomicArb = true;
    let cexDexArbInfo;
    const knownNotBots = ['0x827922686190790b37229fd06084350E74485b72'];
    const knownNotBotsSet = new Set(knownNotBots.map((bot) => bot.toLowerCase()));
    const knownBots = [
        '0x25cE4B4dcb620b73a78f91CD66f6e3e5Ef8f487C',
        '0x802b65b5d9016621E66003aeD0b16615093f328b',
        '0x1195C8b1C3d2a99Be9947c2032D767e2D59352e3',
        '0x758d00D2235bCb30861421b84A3656f29c7d09C1',
        '0xBc57f9DEB97A54E80720250dF91cc5A13eb749c7',
        '0x83885CaB02a0b906836225442Fa17DcFE9cBf797',
    ];
    const knownBotsSet = new Set(knownBots.map((bot) => bot.toLowerCase()));
    if (knownBotsSet.has(to.toLowerCase())) {
        cexDexArbInfo = true;
    }
    else if (knownNotBotsSet.has(to.toLowerCase())) {
        cexDexArbInfo = false;
    }
    else {
        cexDexArbInfo = await isCexDexArbWOdb(cleanedTransfers, from, to, blockNumber, position, txDetails, poolContractAddress, web3HttpProvider, chain);
    }
    let isCexDexArb = false;
    if (cexDexArbInfo === true) {
        isCexDexArb = true;
        volInUsdCexDexArb = volInUsd;
    }
    return {
        txHash,
        from,
        to,
        blockNumber,
        unixTimestamp,
        volInUsd,
        isAtomicArb,
        isCexDexArb,
        volInUsdCexDexArb,
        volInUsdAtomicArb,
    };
}
export async function anyPoolMevCheck() {
    const hourlyData = await loadAndCalculateHourlyVolumes('./result.json');
    console.log(hourlyData);
    await saveHourlyDataToCsvForVisuals(hourlyData, './hourlyData.csv');
    await aggregateAndSaveVolumesByToAddress('./result.json', './volumesByAddress.json');
    // Example usage
    filterAndSaveTransactionsByToAddress('./result.json', './0x758d00d2235bcb30861421b84a3656f29c7d09c1.csv', '0x758d00d2235bcb30861421b84a3656f29c7d09c1');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // 10 mins
    // const startBlock = 17094494;
    // const endBlock = 17094678;
    // 1h
    // const startBlock = 17136568;
    // const endBlock = 17138336;
    // 24h
    // const startBlock = 17170274;
    // const endBlock = 17213664;
    const startBlock = 17170948;
    const endBlock = 17170948;
    const poolContractAddress = '0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59';
    const chain = 'base';
    const web3HttpProvider = await getWeb3HttpProviderForChain(chain);
    const contract = await getCustomContract(web3HttpProvider);
    const events = await getPastEvents(contract, 'AllEvents', startBlock, endBlock);
    if (!Array.isArray(events))
        return;
    console.log('Found', events.length, 'events');
    const uniqueTxHashesSet = new Set();
    for (const event of events) {
        const txHash = event.transactionHash;
        uniqueTxHashesSet.add(txHash);
    }
    const result = [];
    let counterCexDexArbs = 0;
    let counter = 0;
    let fromVolumes = {};
    let toVolumes = {};
    for (const txHash of uniqueTxHashesSet) {
        if (txHash !== '0xd2ac62318cb190669dfdadf7a97dd0c78f478dd608b1a5e8b8c7d6a79da3931f')
            continue;
        // console.log('txHash:', txHash);
        uniqueTxHashesSet.add(txHash);
        const transactionAnalysisResult = await solveSingleTxHash(txHash, chain, web3HttpProvider, poolContractAddress);
        if (!transactionAnalysisResult)
            continue;
        /*
        // Aggregate volInUsd for 'from' address
        fromVolumes[transactionAnalysisResult.from] =
          (fromVolumes[transactionAnalysisResult.from] || 0) + transactionAnalysisResult.volInUsd;
    
        // Aggregate volInUsd for 'to' address
        toVolumes[transactionAnalysisResult.to] =
          (toVolumes[transactionAnalysisResult.to] || 0) + transactionAnalysisResult.volInUsd;
        */
        result.push(transactionAnalysisResult);
        if ((transactionAnalysisResult === null || transactionAnalysisResult === void 0 ? void 0 : transactionAnalysisResult.isCexDexArb) === true)
            counterCexDexArbs++;
        counter++;
        if (counter % 50 === 0) {
            console.log(counter + '/' + uniqueTxHashesSet.size);
            saveResultsToJsonFile(result, 'result.json');
        }
    }
    saveResultsToJsonFile(result, 'result.json');
    // Specify the path where you want to save the CSV file
    const filePath = './transactionAnalysis.csv';
    // Call the function to write data to the CSV
    writeTransactionsToCSV(result, filePath);
    // Save data after the loop
    saveVolumeDictionaryToJsonFile(fromVolumes, 'fromVolumes.json');
    saveVolumeDictionaryToJsonFile(toVolumes, 'toVolumes.json');
    console.log('done');
}
//# sourceMappingURL=AnyAddressMev.js.map